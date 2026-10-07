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
} from '../accounts/accounts.service';

export const ACCOUNT_CONTEXT_FLAG = 'teapts.accountContext';
export const SIGN_UP_NAME_KEY = 'teapts.signUpName';

const logoutLogger = new Logger('Logout');

/**
 * Revoga a sessão atual e, opcionalmente, todas as sessões do usuário.
 *
 * `session.revokeSession` também solicita ao SuperTokens a limpeza dos
 * cookies da resposta associada ao signOutPOST. A operação é segura para
 * uma sessão já revogada: o SDK não exige que a revogação retorne true.
 *
 * @param session sessão validada pelo signOutPOST oficial do SuperTokens
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

/**
 * Valida o campo extra `name` do formulário de cadastro.
 */
export async function validateName(
  value: unknown,
): Promise<string | undefined> {
  if (typeof value !== 'string' || value.trim() === '') {
    return 'Informe o nome';
  }

  return undefined;
}

/**
 * Inicializa o SuperTokens, cria a conta de negócio no cadastro e inclui o
 * contexto da conta na sessão do login e do cadastro.
 */
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
            formFields: [{ id: 'name', validate: validateName }],
          },
          override: {
            functions: (originalImplementation) => ({
              ...originalImplementation,

              signUp: async function (input) {
                const name = input.userContext[SIGN_UP_NAME_KEY];

                if (typeof name !== 'string' || name.trim() === '') {
                  logger.error('Cadastro sem nome no userContext.');
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
                    supertokensUserId: response.user.id,
                    name: name.trim(),
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

                const nameValue = input.formFields.find(
                  (field) =>
                    field.id === 'name' ||
                    field.id === 'fullName' ||
                    field.id === 'nome',
                )?.value;

                if (nameValue) {
                  input.userContext[SIGN_UP_NAME_KEY] = nameValue;
                  input.userContext.name = nameValue;
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

                  const response =
                    await originalImplementation.signInPOST(input);

                  if (response.status === 'WRONG_CREDENTIALS_ERROR') {
                    logger.warn(
                      `Falha de autenticação: status=${response.status}`,
                    );
                    return { status: 'WRONG_CREDENTIALS_ERROR' };
                  }

                  if (response.status !== 'OK') {
                    logger.error(`Falha no sign-in: status=${response.status}`);
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
              signOutPOST: async ({ session, options }) => {
                const body = await options.req.getJSONBody();
                const allSessions =
                  typeof body === 'object' &&
                  body !== null &&
                  'allSessions' in body &&
                  body.allSessions === true;
                await processLogout(session, allSessions);
                return { status: 'OK' };
              },
            }),
          },
        }),
      ],
    });
  }
}
