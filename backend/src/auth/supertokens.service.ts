// Este arquivo cuida da configuração do SuperTokens.
// Ele mantém o endpoint oficial POST /auth/signin e personaliza apenas o login.
// Quando o login dá certo, o contexto da conta é gravado na sessão uma única vez.
// O serviço de contas é usado antes da criação da sessão para impedir identidades órfãs.

import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import supertokens from 'supertokens-node';
import Session from 'supertokens-node/recipe/session';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import {
  AccountIntegrityError,
  AccountsService,
} from '../accounts/accounts.service';

/**
 * Glossário:
 * override: substituição controlada de uma função oficial do SuperTokens.
 * recipe: módulo do SuperTokens, como EmailPassword ou Session.
 * sessão: vínculo autenticado mantido pelos cookies da aplicação.
 * access token: credencial curta usada para validar uma requisição.
 * payload: dados carregados dentro do access token.
 * userContext: contexto interno repassado entre as funções do SuperTokens.
 * guard: componente que decide se uma rota pode continuar.
 * decorator: anotação que entrega um dado já validado ao controller.
 */
export const SIGN_IN_CONTEXT_FLAG = 'teapts.signInContext';

/**
 * Inicializa o SuperTokens e personaliza o login para incluir o contexto
 * da conta na sessão.
 */
@Injectable()
export class SupertokensService {
  private readonly logger = new Logger(SupertokensService.name);

  /**
   * Registra os recipes e os overrides usados pela aplicação.
   *
   * @param accountsService consulta a conta de negócio antes de criar a sessão
   * @throws erro de inicialização quando a configuração do SuperTokens é inválida
   */
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
          override: {
            apis: (originalImplementation) => ({
              ...originalImplementation,

              signInPOST: async function (input) {
                // 1) Marcamos somente este fluxo; o createNewSession verá a mesma referência.
                input.userContext[SIGN_IN_CONTEXT_FLAG] = true;

                try {
                  if (originalImplementation.signInPOST === undefined) {
                    throw new Error(
                      'A implementação original de signInPOST não está disponível',
                    );
                  }

                  // 2) A implementação original valida credenciais e cria a sessão.
                  const response = await originalImplementation.signInPOST(input);

                  // 3) A mesma resposta protege contra enumeração de contas.
                  if (response.status === 'WRONG_CREDENTIALS_ERROR') {
                    logger.warn(
                      `Falha de autenticação: status=${response.status}`,
                    );
                    return { status: 'WRONG_CREDENTIALS_ERROR' };
                  }

                  // 4) Outros resultados continuam com o contrato original.
                  if (response.status !== 'OK') {
                    logger.error(
                      `Falha no sign-in: status=${response.status}`,
                    );
                    return response;
                  }

                  // 5) O log não contém e-mail, senha, token ou cookie.
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
                // Fora do login, não alteramos signup, refresh ou outros fluxos.
                if (input.userContext[SIGN_IN_CONTEXT_FLAG] !== true) {
                  return originalImplementation.createNewSession(input);
                }

                const supertokensUserId = input.recipeUserId.getAsString();

                try {
                  // 1) Resolvemos a conta antes de qualquer criação de sessão.
                  const accountContext =
                    await accountsServiceRef.resolveAccountContext(
                      supertokensUserId,
                    );

                  // 2) A sessão é criada uma única vez, já com o payload final.
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
          },
        }),
      ],
    });
  }
}