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

// Texto do topo do /docs: como autenticar e os dados que o seed cria
// (`pnpm --dir backend run seed:test-user`). Só para desenvolvimento.
const API_DESCRIPTION = `API do backend do TEAPTS Web.

## Como autenticar

1. Rode \`POST /auth/signin\` com o header \`rid: emailpassword\` e o corpo \`{"formFields":[{"id":"email","value":"teste@teapts.local"},{"id":"password","value":"teapts123"}]}\`.
2. Com \`st-auth-mode: cookie\`, o navegador guarda os cookies e as próximas chamadas já vão autenticadas. Com \`st-auth-mode: header\`, copie o \`st-access-token\` da resposta para o botão **Authorize** (esquema \`bearer\`).
3. Chame \`GET /me\`.

Erros saem como \`{ "status": "CODIGO", "message": "..." }\`. O \`401\` é \`{ "message": "unauthorised" }\` (sem token) ou \`"try refresh token"\` (token expirado: chame \`/auth/session/refresh\`).

## Dados de teste (seed)

Só para desenvolvimento. Rode \`make seed\` (Docker) ou \`pnpm --dir backend run seed:test-user\` (local).

| Conta | E-mail | Senha | Perfil |
| --- | --- | --- | --- |
| Administrador | \`teste@teapts.local\` | \`teapts123\` | admin, sem CPF nem perfil |
| Kaio Segunda Conta | \`kaio.admin@teapts.local\` | \`teapts123\` | segundo admin |
| Profissional de Teste | \`profissional@teapts.local\` | \`profissional123\` | psicólogo, CRP-PR 12345 |
| Beatriz Lopes | \`fisioterapeuta@teapts.local\` | \`profissional123\` | fisioterapeuta, Crefito-PR 54321 |
| Paciente de Teste | \`paciente@teapts.local\` | \`paciente123\` | paciente |
| Luna Ferreira | \`luna@teapts.local\` | \`paciente123\` | paciente |
| Diego Alves | \`diego@teapts.local\` | \`paciente123\` | paciente menor de idade, responsável tutelar Paula Alves |
| Bruno Takeda, Priscila Martins, Sofia Andrade, Marcelo Duarte | \`bruno@\`, \`priscila@\`, \`sofia@\`, \`marcela@\` \`teapts.local\` | \`conta123\` | ativas, sem perfil |
| Helena Rocha | \`helena@teapts.local\` | \`conta123\` | **inativa**, sem perfil |

PTS de teste (um de cada status):

| Paciente | Status | Responsável | Equipe |
| --- | --- | --- | --- |
| Paciente de Teste | \`draft\` | Profissional de Teste | Beatriz Lopes |
| Luna Ferreira | \`concluded\` | Profissional de Teste | — |
| Luna Ferreira | \`rejected\` | Beatriz Lopes | — |
| Luna Ferreira | \`running\` | Profissional de Teste | Beatriz Lopes |
| Diego Alves | \`cancelled\` | Profissional de Teste | — |
| Diego Alves | \`planning\` | Beatriz Lopes | Profissional de Teste |

O seed não cria medicações, contatos de suporte, dados clínicos nem eventos de timeline.`;

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
    .setDescription(API_DESCRIPTION)
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
