/*
 * Este teste cobre a lógica dos overrides: conta órfã gera erro, o contexto
 * da conta entra só nas sessões de login e cadastro, o cadastro cria a conta
 * antes da sessão (com compensação se o banco falhar) e credenciais inválidas
 * preservam o contrato. Ele não executa o SuperTokens real.
 */
import { jest } from '@jest/globals';
import { INestApplication, InternalServerErrorException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Express, Request, Response } from 'express';
import request from 'supertest';

type Payload = Record<string, unknown>;
type Fn = (input: Payload) => Promise<Payload>;
type Implementation = Record<string, Fn>;
type FormField = { id: string; value: unknown };

type CapturedConfig = {
  recipeList: Array<{
    signUpFeature?: {
      formFields: Array<{
        id: string;
        validate: (value: unknown) => Promise<string | undefined>;
      }>;
    };
    override?: {
      apis?: (implementation: Implementation) => Implementation;
      functions?: (implementation: Implementation) => Implementation;
    };
  }>;
};

// Sob ESM os mocks de módulo não são içados: eles são registrados antes e o
// código da aplicação é importado depois, com import dinâmico.
class MockSuperTokensError extends Error {}
const supertokensInit = jest.fn<(config: CapturedConfig) => void>();
const deleteUser = jest.fn<(userId: string) => Promise<Payload>>();
const revokeAllSessionsForUser =
  jest.fn<(userId: string) => Promise<string[]>>();

jest.unstable_mockModule('supertokens-node', () => ({
  default: {
    init: supertokensInit,
    deleteUser,
    Error: MockSuperTokensError,
  },
}));

jest.unstable_mockModule('supertokens-node/recipe/emailpassword', () => ({
  default: { init: jest.fn((config: unknown) => config) },
}));

jest.unstable_mockModule('supertokens-node/recipe/session', () => ({
  default: {
    init: jest.fn((config: unknown) => config),
    revokeAllSessionsForUser,
  },
}));

jest.unstable_mockModule(
  'supertokens-node/recipe/session/framework/express',
  () => ({
    verifySession: jest.fn(
      () =>
        async (
          _request: Request,
          _response: Response,
          next: (error?: unknown) => void,
        ) =>
          next(),
    ),
  }),
);

// Import dinâmico com `.js`: exigido pelo nodenext; o Jest mapeia para `.ts`.
type AccountsModule = typeof import('../src/accounts/accounts.service.js');
type SupertokensModule = typeof import('../src/auth/supertokens.service.js');

let AccountIntegrityError: AccountsModule['AccountIntegrityError'];
let AccountsService: AccountsModule['AccountsService'];
let AuthController: (typeof import('../src/auth/auth.controller.js'))['AuthController'];
let AuthGuard: (typeof import('../src/auth/guards/auth.guard.js'))['AuthGuard'];
let SupertokensService: SupertokensModule['SupertokensService'];
let ACCOUNT_CONTEXT_FLAG: SupertokensModule['ACCOUNT_CONTEXT_FLAG'];
let SIGN_UP_NAME_KEY: SupertokensModule['SIGN_UP_NAME_KEY'];
let validateName: SupertokensModule['validateName'];
let processLogout: SupertokensModule['processLogout'];

beforeAll(async () => {
  ({ AccountIntegrityError, AccountsService } =
    await import('../src/accounts/accounts.service.js'));
  ({ AuthController } = await import('../src/auth/auth.controller.js'));
  ({ AuthGuard } = await import('../src/auth/guards/auth.guard.js'));
  ({
    ACCOUNT_CONTEXT_FLAG,
    SIGN_UP_NAME_KEY,
    SupertokensService,
    processLogout,
    validateName,
  } = await import('../src/auth/supertokens.service.js'));
});

function field(formFields: FormField[], id: string): unknown {
  return formFields.find((formField) => formField.id === id)?.value;
}

describe('authentication integration', () => {
  const accountUserId = 'supertokens-account-user';
  const orphanUserId = 'supertokens-orphan-user';
  const newUserId = 'supertokens-new-user';
  const accountContext = {
    accountId: 'account-1',
    role: 'user',
    patientProfileId: null,
    professionalProfileIds: [],
  };

  let app: Express;
  let nestApplication: INestApplication;
  let accountsService: {
    resolveAccountContext: jest.Mock<(userId: string) => Promise<Payload>>;
    findById: jest.Mock<() => Promise<Payload>>;
    createAccount: jest.Mock<(input: Payload) => Promise<Payload>>;
  };
  let createNewSession: jest.Mock<Fn>;
  let originalSignUp: jest.Mock<Fn>;
  let sessionImplementation: Implementation;
  let sessionApiImplementation: Implementation;
  let emailPasswordFunctions: Implementation;
  let emailPasswordApis: Implementation;

  function signUpInput(name: unknown, email = 'maria@example.com') {
    return {
      formFields: [
        { id: 'email', value: email },
        { id: 'password', value: 'Senha-de-teste-123!' },
        { id: 'name', value: name },
      ],
      userContext: {} as Payload,
    };
  }

  beforeEach(async () => {
    accountsService = {
      resolveAccountContext: jest.fn(async (userId: string) => {
        if (userId === orphanUserId) {
          throw new AccountIntegrityError();
        }

        return accountContext;
      }),
      findById: jest.fn(async () => ({
        id: accountContext.accountId,
        name: 'Conta de teste',
        email: 'teste@example.com',
        role: accountContext.role,
      })),
      createAccount: jest.fn(async (input: Payload) => ({
        id: 'account-2',
        ...input,
      })),
    };

    supertokensInit.mockImplementation((config) => {
      const [emailPasswordConfig, sessionConfig] = config.recipeList;

      createNewSession = jest.fn<Fn>(async () => ({
        handle: 'session-handle',
      }));
      sessionImplementation = sessionConfig.override!.functions!({
        createNewSession,
      });
      sessionApiImplementation = sessionConfig.override!.apis!({
        signOutPOST: jest.fn<Fn>(async () => ({ status: 'OK' })),
      });

      originalSignUp = jest.fn<Fn>(async (input) =>
        input.email === 'taken@example.com'
          ? { status: 'EMAIL_ALREADY_EXISTS_ERROR' }
          : {
              status: 'OK',
              user: { id: newUserId },
              recipeUserId: { getAsString: () => newUserId },
            },
      );
      emailPasswordFunctions = emailPasswordConfig.override!.functions!({
        signUp: originalSignUp,
      });

      // Reproduz a ordem do SDK: signUp (functions) e depois a sessão.
      const originalSignUpPOST: Fn = async (input) => {
        const formFields = input.formFields as FormField[];
        const response = await emailPasswordFunctions.signUp({
          email: field(formFields, 'email'),
          password: field(formFields, 'password'),
          tenantId: 'public',
          userContext: input.userContext,
        });

        if (response.status !== 'OK') {
          return response;
        }

        const user = response.user as { id: string };
        await sessionImplementation.createNewSession({
          userId: user.id,
          recipeUserId: response.recipeUserId,
          userContext: input.userContext,
          accessTokenPayload: {},
        });

        return { status: 'OK', user };
      };

      const originalSignInPOST: Fn = async (input) => {
        const formFields = input.formFields as FormField[];

        if (field(formFields, 'password') === 'wrong-password') {
          return { status: 'WRONG_CREDENTIALS_ERROR' };
        }

        const email = field(formFields, 'email');
        if (email === 'supertokens-error@example.com') {
          throw new MockSuperTokensError('erro do SuperTokens');
        }

        const userId =
          email === 'orphan@example.com' ? orphanUserId : accountUserId;

        await sessionImplementation.createNewSession({
          userId,
          recipeUserId: { getAsString: () => userId },
          userContext: input.userContext,
          accessTokenPayload: {},
        });

        return { status: 'OK', user: { id: userId } };
      };

      emailPasswordApis = emailPasswordConfig.override!.apis!({
        signInPOST: originalSignInPOST,
        signUpPOST: originalSignUpPOST,
      });
    });

    const accountsModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthGuard,
        {
          provide: AccountsService,
          useValue: accountsService,
        },
      ],
    }).compile();

    new SupertokensService(
      accountsService as unknown as InstanceType<typeof AccountsService>,
    );

    nestApplication =
      accountsModule.createNestApplication<NestExpressApplication>();
    // Os overrides registram falhas esperadas; o log poluiria a saída.
    nestApplication.useLogger(false);
    (nestApplication as NestExpressApplication).useBodyParser('json');
    app = nestApplication.getHttpAdapter().getInstance();

    app.post('/auth/signin', async (req, res) => {
      try {
        const response = await emailPasswordApis.signInPOST({
          formFields: req.body.formFields,
          userContext: {},
        });

        res.status(200).json(response);
      } catch (error) {
        const status =
          error instanceof InternalServerErrorException
            ? error.getStatus()
            : 500;
        res.status(status).json({
          message:
            error instanceof Error ? error.message : 'Internal Server Error',
        });
      }
    });

    await nestApplication.init();
  });

  afterEach(async () => {
    await nestApplication.close();
  });

  describe('signin', () => {
    it('signs in a user with an account and puts the context in the session', async () => {
      const response = await request(app)
        .post('/auth/signin')
        .set('st-auth-mode', 'cookie')
        .send({
          formFields: [
            { id: 'email', value: 'account@example.com' },
            { id: 'password', value: 'correct-password' },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('OK');
      expect(accountsService.resolveAccountContext).toHaveBeenCalledWith(
        accountUserId,
      );
      expect(createNewSession).toHaveBeenCalledWith(
        expect.objectContaining({
          accessTokenPayload: accountContext,
        }),
      );
    });

    it('blocks an orphan user', async () => {
      const response = await request(app)
        .post('/auth/signin')
        .set('st-auth-mode', 'cookie')
        .send({
          formFields: [
            { id: 'email', value: 'orphan@example.com' },
            { id: 'password', value: 'correct-password' },
          ],
        });

      expect(response.status).toBe(500);
      expect(createNewSession).not.toHaveBeenCalled();
    });

    it('returns WRONG_CREDENTIALS_ERROR for an invalid password', async () => {
      const response = await request(app)
        .post('/auth/signin')
        .set('st-auth-mode', 'cookie')
        .send({
          formFields: [
            { id: 'email', value: 'account@example.com' },
            { id: 'password', value: 'wrong-password' },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'WRONG_CREDENTIALS_ERROR' });
    });

    it('relays a SuperTokens error without converting it to a generic error', async () => {
      const response = await request(app)
        .post('/auth/signin')
        .set('st-auth-mode', 'cookie')
        .send({
          formFields: [
            { id: 'email', value: 'supertokens-error@example.com' },
            { id: 'password', value: 'correct-password' },
          ],
        });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('erro do SuperTokens');
    });
  });

  describe('signup', () => {
    it('validates the name form field', async () => {
      await expect(validateName('Maria')).resolves.toBeUndefined();
      await expect(validateName('   ')).resolves.toBe('Informe o nome');
      await expect(validateName(42)).resolves.toBe('Informe o nome');
    });

    it('creates the account before opening the session', async () => {
      const input = signUpInput('  Maria  ');

      await expect(emailPasswordApis.signUpPOST(input)).resolves.toMatchObject({
        status: 'OK',
      });

      expect(accountsService.createAccount).toHaveBeenCalledWith({
        supertokensUserId: newUserId,
        name: 'Maria',
        email: 'maria@example.com',
      });
      expect(accountsService.resolveAccountContext).toHaveBeenCalledWith(
        newUserId,
      );
      expect(
        accountsService.createAccount.mock.invocationCallOrder[0],
      ).toBeLessThan(createNewSession.mock.invocationCallOrder[0]);
      expect(createNewSession).toHaveBeenCalledWith(
        expect.objectContaining({ accessTokenPayload: accountContext }),
      );
      expect(input.userContext[ACCOUNT_CONTEXT_FLAG]).toBe(true);
    });

    it('deletes the SuperTokens user when the account cannot be created', async () => {
      accountsService.createAccount.mockRejectedValue(
        new Error('duplicate key'),
      );

      await expect(
        emailPasswordApis.signUpPOST(signUpInput('Maria')),
      ).rejects.toBeInstanceOf(InternalServerErrorException);

      expect(deleteUser).toHaveBeenCalledWith(newUserId);
      expect(createNewSession).not.toHaveBeenCalled();
    });

    it('does not create an account when the email already exists', async () => {
      await expect(
        emailPasswordApis.signUpPOST(signUpInput('Maria', 'taken@example.com')),
      ).resolves.toEqual({ status: 'EMAIL_ALREADY_EXISTS_ERROR' });

      expect(accountsService.createAccount).not.toHaveBeenCalled();
    });

    it('refuses to create an identity without a name in the userContext', async () => {
      await expect(
        emailPasswordFunctions.signUp({
          email: 'maria@example.com',
          password: 'Senha-de-teste-123!',
          tenantId: 'public',
          userContext: {},
        }),
      ).rejects.toBeInstanceOf(InternalServerErrorException);

      expect(originalSignUp).not.toHaveBeenCalled();
    });

    it('passes the name through the userContext', async () => {
      const input = signUpInput('Maria');

      await emailPasswordApis.signUpPOST(input);

      expect(input.userContext[SIGN_UP_NAME_KEY]).toBe('Maria');
    });
  });

  describe('session', () => {
    it('does not add the account context outside signin and signup', async () => {
      const input = {
        userId: accountUserId,
        userContext: {},
        accessTokenPayload: {},
      };

      await sessionImplementation.createNewSession(input);

      expect(accountsService.resolveAccountContext).not.toHaveBeenCalled();
      expect(createNewSession).toHaveBeenCalledWith(input);
    });

    it('returns 401 for GET /me without a valid session payload', async () => {
      // verifySession está mockado; o 401 vem do parseAccountContext.
      const response = await request(app).get('/me');

      expect(response.status).toBe(401);
    });

    it('revokes the current session and returns OK', async () => {
      const revokeSession = jest.fn(async () => undefined);
      const session = {
        getUserId: () => accountUserId,
        revokeSession,
      };

      await expect(
        sessionApiImplementation.signOutPOST({
          session,
          options: {
            req: {
              getJSONBody: async () => ({ allSessions: false }),
            },
          },
        }),
      ).resolves.toEqual({ status: 'OK' });

      expect(revokeSession).toHaveBeenCalledTimes(1);
    });

    it('revokes every session when allSessions is true', async () => {
      const revokeSession = jest.fn(async () => undefined);
      revokeAllSessionsForUser.mockResolvedValue([]);
      const session = {
        getUserId: () => accountUserId,
        revokeSession,
      };

      await expect(
        sessionApiImplementation.signOutPOST({
          session,
          options: {
            req: {
              getJSONBody: async () => ({ allSessions: true }),
            },
          },
        }),
      ).resolves.toEqual({ status: 'OK' });
      expect(revokeAllSessionsForUser).toHaveBeenCalledWith(accountUserId);
      expect(revokeAllSessionsForUser).toHaveBeenCalledTimes(1);
    });

    it('is idempotent when the current session was already revoked', async () => {
      const session = {
        getUserId: () => accountUserId,
        revokeSession: jest.fn(async () => undefined),
      };

      await expect(
        processLogout(
          session as unknown as Parameters<typeof processLogout>[0],
          false,
        ),
      ).resolves.toBeUndefined();
      await expect(
        processLogout(
          session as unknown as Parameters<typeof processLogout>[0],
          false,
        ),
      ).resolves.toBeUndefined();

      expect(session.revokeSession).toHaveBeenCalledTimes(2);
    });
  });
});
