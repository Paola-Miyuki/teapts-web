import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import supertokens from 'supertokens-node';
import Session from 'supertokens-node/recipe/session';
import type { SessionContainer } from 'supertokens-node/recipe/session';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import {
  AccountIntegrityError,
  AccountsService,
} from '../../accounts/services/accounts.service';
import {
  onlyDigits,
  readSignUpFields,
  SIGN_UP_ACCOUNT_KEY,
  SIGN_UP_FIELD_IDS,
  type SignUpAccountFields,
  validateBirthDate,
  validateCpf,
  validateGender,
  validateName,
  validatePhone,
  validateSex,
  validateSocialName,
} from '../sign-up-fields';

export const ACCOUNT_CONTEXT_FLAG = 'teapts.accountContext';

const logoutLogger = new Logger('Logout');

/**
 * Revoga a sessão atual e, opcionalmente, todas as sessões do usuário.
 *
 * `session.revokeSession` também solicita ao SuperTokens a limpeza dos
 * cookies da resposta associada à sessão. A operação é segura para uma
 * sessão já revogada: o SDK não exige que a revogação retorne true.
 *
 * @param session sessão validada pelo AuthGuard no POST /auth/logout
 * @param allSessions quando true, revoga todas as sessões do usuário
 */
export async function processLogout(
  session: SessionContainer,
  allSessions: boolean,
): Promise<void> {
  const userId = session.getUserId();

  await session.revokeSession();

  if (allSessions) {
    await Session.revokeAllSessionsForUser(userId);
  }

  logoutLogger.log(
    `Logout concluído. userId=${userId} allSessions=${allSessions}`,
  );
}
@Injectable()
export class SupertokensService {
  private readonly logger = new Logger(SupertokensService.name);

  constructor(private readonly accountsService: AccountsService) {
    const logger = this.logger;
    const accountsServiceRef = this.accountsService;

    supertokens.init({
      framework: 'express',
      supertokens: {
        connectionURI:
          process.env.SUPERTOKENS_CONNECTION_URI || 'http://localhost:3567',
        apiKey: process.env.SUPERTOKENS_API_KEY || undefined,
      },
      appInfo: {
        appName: 'TEA-PTS',
        apiDomain: process.env.API_DOMAIN || 'http://localhost:3000',
        websiteDomain: process.env.WEBSITE_DOMAIN || 'http://localhost:3001',
        apiBasePath: '/auth',
        websiteBasePath: '/auth',
      },
      recipeList: [
        EmailPassword.init({
          signUpFeature: {
            formFields: [
              { id: SIGN_UP_FIELD_IDS.name, validate: validateName },
              {
                id: SIGN_UP_FIELD_IDS.socialName,
                validate: validateSocialName,
                optional: true,
              },
              { id: SIGN_UP_FIELD_IDS.birthDate, validate: validateBirthDate },
              { id: SIGN_UP_FIELD_IDS.sex, validate: validateSex },
              {
                id: SIGN_UP_FIELD_IDS.gender,
                validate: validateGender,
                optional: true,
              },
              {
                id: SIGN_UP_FIELD_IDS.cpf,
                // CPF único entre as contas (RN001).
                validate: async (value: unknown) =>
                  (await validateCpf(value)) ??
                  ((await accountsServiceRef.isCpfTaken(
                    onlyDigits(value as string),
                  ))
                    ? 'Este CPF já está cadastrado'
                    : undefined),
              },
              {
                id: SIGN_UP_FIELD_IDS.phone,
                validate: validatePhone,
                optional: true,
              },
            ],
          },
          override: {
            functions: (originalImplementation) => ({
              ...originalImplementation,

              signUp: async function (input) {
                // Lê os dados da conta do userContext preenchido pela camada de API (signUpPOST)
                const fields = input.userContext[SIGN_UP_ACCOUNT_KEY] as
                  SignUpAccountFields | undefined;

                if (!fields) {
                  logger.error(
                    'Cadastro sem os dados da conta no userContext.',
                  );
                  throw new InternalServerErrorException(
                    'Não foi possível concluir o cadastro',
                  );
                }

                const response = await originalImplementation.signUp(input);

                if (response.status !== 'OK') {
                  return response;
                }

                try {
                  await accountsServiceRef.createAccount({
                    ...fields,
                    supertokensUserId: response.user.id,
                    email: input.email.trim().toLowerCase(),
                  });
                } catch (error) {
                  logger.error(
                    `Falha ao criar a conta; desfazendo o usuário. userId=${response.user.id}`,
                    error instanceof Error ? error.stack : undefined,
                  );

                  try {
                    await supertokens.deleteUser(response.user.id);
                  } catch (deleteError) {
                    logger.error(
                      `Falha ao desfazer o usuário do SuperTokens. userId=${response.user.id}`,
                      deleteError instanceof Error
                        ? deleteError.stack
                        : undefined,
                    );
                  }

                  throw new InternalServerErrorException(
                    'Não foi possível concluir o cadastro',
                  );
                }

                return response;
              },
            }),
            apis: (originalImplementation) => ({
              ...originalImplementation,

              signUpPOST: async function (input) {
                if (originalImplementation.signUpPOST === undefined) {
                  throw new Error(
                    'A implementação original de signUpPOST não está disponível',
                  );
                }

                const fields = readSignUpFields(input.formFields);

                if (fields) {
                  input.userContext[SIGN_UP_ACCOUNT_KEY] = fields;
                }

                input.userContext[ACCOUNT_CONTEXT_FLAG] = true;

                return originalImplementation.signUpPOST(input);
              },

              signInPOST: async function (input) {
                input.userContext[ACCOUNT_CONTEXT_FLAG] = true;

                try {
                  if (originalImplementation.signInPOST === undefined) {
                    throw new Error(
                      'A implementação original de signInPOST não está disponível',
                    );
                  }

                  // Conta desativada (RFAUT005) não autentica; a resposta é a
                  // mesma de credenciais erradas, sem revelar o motivo.
                  const email = input.formFields.find(
                    (field) => field.id === 'email',
                  )?.value;

                  if (
                    typeof email === 'string' &&
                    (await accountsServiceRef.isEmailDeactivated(email))
                  ) {
                    logger.warn('Login recusado: conta desativada');
                    return { status: 'WRONG_CREDENTIALS_ERROR' };
                  }

                  const response =
                    await originalImplementation.signInPOST(input);

                  if (response.status === 'WRONG_CREDENTIALS_ERROR') {
                    logger.warn(
                      `Falha de autenticação: status=${response.status}`,
                    );
                    return { status: 'WRONG_CREDENTIALS_ERROR' };
                  }

                  if (response.status !== 'OK') {
                    logger.error(`Falha no login: status=${response.status}`);
                    return response;
                  }

                  logger.log(
                    `Autenticação efetuada com sucesso. userId=${response.user.id}`,
                  );

                  return response;
                } catch (error) {
                  if (error instanceof AccountIntegrityError) {
                    logger.warn(
                      'Login bloqueado para usuário sem conta de negócio',
                    );
                    throw error;
                  }

                  if (error instanceof supertokens.Error) {
                    throw error;
                  }

                  if (error instanceof Error) {
                    logger.error(
                      'Falha inesperada na autenticação',
                      error.stack,
                    );
                  } else {
                    logger.error('Falha inesperada na autenticação');
                  }

                  throw new InternalServerErrorException(
                    'Não foi possível concluir a autenticação',
                  );
                }
              },
            }),
          },
        }),
        Session.init({
          override: {
            functions: (originalImplementation) => ({
              ...originalImplementation,
              createNewSession: async (input) => {
                if (input.userContext[ACCOUNT_CONTEXT_FLAG] !== true) {
                  return originalImplementation.createNewSession(input);
                }

                const supertokensUserId = input.userId;

                try {
                  const accountContext =
                    await accountsServiceRef.resolveAccountContext(
                      supertokensUserId,
                    );

                  return originalImplementation.createNewSession({
                    ...input,
                    accessTokenPayload: {
                      ...input.accessTokenPayload,
                      ...accountContext,
                    },
                  });
                } catch (error) {
                  if (error instanceof AccountIntegrityError) {
                    logger.warn(
                      `Sessão bloqueada para usuário sem conta de negócio. userId=${supertokensUserId}`,
                    );
                    throw error;
                  }

                  if (error instanceof supertokens.Error) {
                    throw error;
                  }

                  if (error instanceof Error) {
                    logger.error(
                      `Falha ao criar sessão. userId=${supertokensUserId}`,
                      error.stack,
                    );
                  } else {
                    logger.error(
                      `Falha ao criar sessão. userId=${supertokensUserId}`,
                    );
                  }

                  throw new InternalServerErrorException(
                    'Não foi possível criar a sessão',
                  );
                }
              },
            }),
            apis: (originalImplementation) => ({
              ...originalImplementation,
              // O logout é o POST /auth/logout do AuthController.
              signOutPOST: undefined,
            }),
          },
        }),
      ],
    });
  }
}
