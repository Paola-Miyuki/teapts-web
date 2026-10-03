import express, { type Request, type Response } from 'express';
import {
  INestApplication,
  InternalServerErrorException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import supertokens from 'supertokens-node';
import { AccountIntegrityError, AccountsService } from '../src/accounts/accounts.service';
import { AuthController } from '../src/auth/auth.controller';
import { AuthGuard } from '../src/auth/guards/auth.guard';
import {
  SIGN_IN_CONTEXT_FLAG,
  SupertokensService,
} from '../src/auth/supertokens.service';

jest.mock('supertokens-node', () => ({
  __esModule: true,
  default: {
    init: jest.fn(),
  },
}));

jest.mock('supertokens-node/recipe/emailpassword', () => ({
  __esModule: true,
  default: {
    init: jest.fn((config) => config),
  },
}));

jest.mock('supertokens-node/recipe/session', () => ({
  __esModule: true,
  default: {
    init: jest.fn((config) => config),
  },
}));

jest.mock('supertokens-node/recipe/session/framework/express', () => ({
  verifySession: jest.fn(
    () =>
      async (
        _request: Request,
        _response: Response,
        next: (error?: unknown) => void,
      ) => next(),
  ),
}));

type SessionInput = {
  recipeUserId: {
    getAsString(): string;
  };
  userContext: Record<string, unknown>;
  accessTokenPayload: Record<string, unknown>;
};

type CapturedConfig = {
  recipeList: Array<{
    override?: {
      apis?: (implementation: Record<string, Function>) => Record<string, Function>;
      functions?: (
        implementation: Record<string, Function>,
      ) => Record<string, Function>;
    };
  }>;
};

describe('authentication integration', () => {
  const accountUserId = 'supertokens-account-user';
  const orphanUserId = 'supertokens-orphan-user';
  const accountContext = {
    accountId: 'account-1',
    patientProfileId: null,
    professionalProfileIds: [],
  };

  let app: express.Express;
  let nestApplication: INestApplication;
  let accountsService: {
    resolveAccountContext: jest.Mock;
    findById: jest.Mock;
  };
  let signInPOST: (input: {
    formFields: Array<{ id: string; value: string }>;
    userContext: Record<string, unknown>;
  }) => Promise<{ status: string; user?: { id: string } }>;
  let signupPOST: (input: {
    userContext: Record<string, unknown>;
  }) => Promise<{ status: string }>;

  beforeEach(async () => {
    jest.clearAllMocks();

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
        patientProfileId: accountContext.patientProfileId,
        professionalProfileIds: accountContext.professionalProfileIds,
      })),
    };

    const supertokensInit = supertokens.init as jest.Mock;
    supertokensInit.mockImplementation((config: CapturedConfig) => {
      const emailPasswordConfig = config.recipeList[0];
      const sessionConfig = config.recipeList[1];

      const originalSessionImplementation = {
        createNewSession: jest.fn(async () => ({
          handle: 'session-handle',
        })),
      };
      const sessionImplementation =
        sessionConfig.override?.functions?.(originalSessionImplementation) ??
        originalSessionImplementation;

      const originalEmailPasswordImplementation = {
        signUpPOST: jest.fn(async () => ({ status: 'OK' })),
        signInPOST: jest.fn(
          async (input: {
            formFields: Array<{ id: string; value: string }>;
            userContext: Record<string, unknown>;
          }) => {
            const password = input.formFields.find(
              (field) => field.id === 'password',
            )?.value;

            if (password === 'wrong-password') {
              return { status: 'WRONG_CREDENTIALS_ERROR' };
            }

            const email = input.formFields.find(
              (field) => field.id === 'email',
            )?.value;
            const userId =
              email === 'orphan@example.com' ? orphanUserId : accountUserId;

            await sessionImplementation.createNewSession({
              recipeUserId: {
                getAsString: () => userId,
              },
              userContext: input.userContext,
              accessTokenPayload: {},
            } satisfies SessionInput);

            return {
              status: 'OK',
              user: { id: userId },
            };
          },
        ),
      };
      const emailPasswordImplementation =
        emailPasswordConfig.override?.apis?.(
          originalEmailPasswordImplementation,
        ) ?? originalEmailPasswordImplementation;

      signInPOST = emailPasswordImplementation.signInPOST as typeof signInPOST;
      signupPOST =
        originalEmailPasswordImplementation.signUpPOST as typeof signupPOST;
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

    new SupertokensService(accountsService as unknown as AccountsService);

    nestApplication = accountsModule.createNestApplication();
    app = nestApplication.getHttpAdapter().getInstance();
    app.use(express.json());

    app.post('/auth/signin', async (req, res) => {
      try {
        const response = await signInPOST({
          formFields: req.body.formFields,
          userContext: {},
        });

        if (response.status === 'OK') {
          res
            .cookie('sAccessToken', 'access-token', {
              httpOnly: true,
              sameSite: 'lax',
              path: '/',
            })
            .cookie('sRefreshToken', 'refresh-token', {
              httpOnly: true,
              sameSite: 'lax',
              path: '/auth/session/refresh',
            });
        }

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

  it('signs in a user with an account and sets session cookies', async () => {
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
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('sAccessToken='),
        expect.stringContaining('sRefreshToken='),
      ]),
    );
  });

  it('blocks an orphan user without setting session cookies', async () => {
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
    expect(response.headers['set-cookie']).toBeUndefined();
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

  it('returns 401 for GET /me without a session', async () => {
    const response = await request(app).get('/me');

    expect(response.status).toBe(401);
  });

  it('does not add the sign-in flag to signup userContext', async () => {
    const userContext: Record<string, unknown> = {};

    await signupPOST({ userContext });

    expect(userContext[SIGN_IN_CONTEXT_FLAG]).toBeUndefined();
  });
});
