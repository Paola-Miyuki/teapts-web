// Este arquivo monta a documentação OpenAPI da API e a publica em /docs
// (interface do Swagger) e /docs-json (JSON). Fica ligada em todos os
// ambientes. Os esquemas dos DTOs vêm do plugin do @nestjs/swagger, que lê
// os decorators do class-validator (ver nest-cli.json).

import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { REFRESH_SECURITY_NAME, supertokensPaths } from './supertokens-paths';

/** Caminho da interface; o JSON fica em `/<caminho>-json`. */
export const SWAGGER_PATH = 'docs';

/** Cookie de acesso que o SuperTokens grava no modo cookie. */
export const SESSION_COOKIE_NAME = 'sAccessToken';

/**
 * Gera o documento OpenAPI da aplicação e registra as rotas de documentação.
 *
 * Declara os dois modos de sessão do SuperTokens: cookie (`sAccessToken`) e
 * header (`Authorization: Bearer`, com `st-auth-mode: header` no login), e
 * acrescenta as rotas do SDK do SuperTokens, que não são controllers.
 *
 * @param app aplicação NestJS já criada, antes do `listen`/`init`
 */
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('TEAPTS Web API')
    .setDescription('API do backend do TEAPTS Web.')
    .setVersion('0.0.1')
    .addCookieAuth(SESSION_COOKIE_NAME, {
      type: 'apiKey',
      in: 'cookie',
      description: 'Sessão do SuperTokens no modo cookie.',
    })
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      description:
        'Sessão do SuperTokens no modo header (login com `st-auth-mode: header`).',
    })
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        description:
          'Refresh token do modo header, usado só no `/auth/session/refresh`.',
      },
      REFRESH_SECURITY_NAME,
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  document.paths = { ...document.paths, ...supertokensPaths };
  SwaggerModule.setup(SWAGGER_PATH, app, document);
}
