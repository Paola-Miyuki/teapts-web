// Este arquivo cuida da configuração do SuperTokens.
// Ele mantém o endpoint oficial POST /auth/signin e personaliza apenas o login.
// Quando o login dá certo, o contexto da conta é gravado na sessão uma única vez.
// O serviço de contas é usado antes da criação da sessão para impedir identidades órfãs.

import { Injectable, Logger } from '@nestjs/common';
import supertokens from 'supertokens-node';
import Session from 'supertokens-node/recipe/session';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import { AccountsService } from '../accounts/accounts.service';

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

              signInPOST: async (input) => {
                // 1) Marcamos somente este fluxo; o createNewSession verá a mesma referência.
                input.userContext[SIGN_IN_CONTEXT_FLAG] = true;

                try {
                  const originalSignInPOST =
                    originalImplementation.signInPOST;
                  if (originalSignInPOST === undefined) {
                    throw new Error(
                      'A implementação original de signInPOST não está disponível',
                    );
                  }

                  // 2) A implementação original valida credenciais e cria a sessão.
                  const response = await originalSignInPOST(input);

                  // 3) A mesma resposta protege contra enumeração de contas.
                  if (response.status === 'WRONG_CREDENTIALS_ERROR') {
                    this.logger.warn(
                      `Falha de autenticação: status=${response.status}`,
                    );
                    return { status: 'WRONG_CREDENTIALS_ERROR' };
                  }

                  // 4) Outros resultados continuam com o contrato original.
                  if (response.status !== 'OK') {
                    this.logger.error(
                      `Falha no sign-in: status=${response.status}`,
                    );
                    return response;
                  }

                  // 5) O log não contém e-mail, senha, token ou cookie.
                  this.logger.log(
                    `Autenticação efetuada com sucesso. userId=${response.user.id}`,
                  );

                  return response;
                } catch (error) {
                  this.logger.error('Falha inesperada na autenticação');
                  throw error;
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
                    await this.accountsService.resolveAccountContext(
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
                  // 3) Sem conta não há sessão válida; o erro de integridade sobe.
                  this.logger.error(
                    `Erro de integridade ao criar sessão. userId=${supertokensUserId}`,
                  );
                  throw error;
                }
              },
            }),
          },
        }),
      ],
    });
  }
}
