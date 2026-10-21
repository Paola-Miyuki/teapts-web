# Backend (NestJS)

API do TEA-PTS: NestJS + TypeORM + PostgreSQL, com autenticação pelo
SuperTokens.

Este arquivo cobre só o que é do código do backend: scripts, variáveis e
estrutura. Para rodar a stack, use o [README da raiz](../README.md):

- setup e primeira execução: seções 1 a 4;
- migrations, schemas e conta de teste: seção 5 ("Banco de dados");
- fluxo de login, rotas, curls e respostas de erro: seção 6 ("Autenticação").

Com a API no ar, a documentação OpenAPI fica em `http://localhost:3000/docs`
(JSON em `/docs-json`).

## Scripts

Rode de dentro de `backend/` ou da raiz com `pnpm --dir backend run <script>`.

| Script                               | O que faz                                                          |
| ------------------------------------ | ------------------------------------------------------------------ |
| `start:dev`                          | API em watch na porta `PORT` (padrão 3000)                         |
| `start:debug`                        | igual ao `start:dev`, com o inspector do Node                      |
| `build` / `start:prod`               | compila para `dist/` / roda a partir de `dist/`                    |
| `migration:show`                     | lista as migrations (`[X]` = aplicada)                             |
| `migration:run` / `migration:revert` | aplica as pendentes / desfaz a última                              |
| `migration:generate <caminho>`       | gera migration comparando as entidades com o banco no ar           |
| `seed:test-user`                     | cria `teste@teapts.local` / `teapts123`; precisa do SuperTokens no ar |
| `test` / `test:cov` / `test:watch`   | testes unitários (Jest em ESM)                                     |
| `test:e2e`                           | sobe o `AppModule` e chama as rotas por HTTP                       |
| `lint` / `typecheck`                 | ESLint / `tsc --noEmit`                                            |
| `format` / `format:check`            | Prettier, alterando ou só conferindo                               |

Os testes unitários e e2e não precisam de PostgreSQL nem de SuperTokens: o
repositório e o Core do SuperTokens são substituídos por mocks.

O `pnpm install` também registra os hooks do Git (o `prepare` aponta o
`core.hooksPath` para `.husky/` da raiz).

## Variáveis de ambiente

`cp .env.example .env` (ou `make env` na raiz). Os valores do exemplo
funcionam em desenvolvimento; só falta preencher `DATABASE_PASSWORD`.

| Variável                     | Padrão                  | Uso                                         |
| ---------------------------- | ----------------------- | ------------------------------------------- |
| `PORT`                       | `3000`                  | porta HTTP da API                           |
| `DATABASE_HOST`              | `localhost`             | host do PostgreSQL                          |
| `DATABASE_PORT`              | `5432`                  | porta do PostgreSQL                         |
| `DATABASE_USER`              | `teapts`                | usuário do PostgreSQL                       |
| `DATABASE_PASSWORD`          | vazio                   | senha do PostgreSQL (só no `.env`)          |
| `DATABASE_NAME`              | `teapts`                | nome do banco                               |
| `WEBSITE_DOMAIN`             | `http://localhost:3001` | origem do frontend (CORS e cookies)         |
| `API_DOMAIN`                 | `http://localhost:3000` | domínio público da API                      |
| `SUPERTOKENS_CONNECTION_URI` | `http://localhost:3567` | endereço do Core do SuperTokens             |
| `SUPERTOKENS_API_KEY`        | vazio                   | chave do Core (vazia em dev)                |
| `SUPERTOKENS_VERSION`        | `latest`                | tag da imagem do Core no Compose; fixe uma  |

No Docker, o Compose troca `DATABASE_HOST` por `postgres` e
`SUPERTOKENS_CONNECTION_URI` por `http://supertokens:3567`.

## Estrutura

```
src/
  main.ts                  bootstrap, ValidationPipe global, Swagger e porta
  create-app.ts            CORS, middleware() e errorHandler() do SuperTokens,
                           ValidationPipe global (usado nos testes)
  app.module.ts            ConfigModule + TypeOrmModule + módulos da API
  common/
    validation/create-validation-pipe.ts   ValidationPipe e formato { status, message }
    swagger/setup-swagger.ts               documento OpenAPI em /docs e /docs-json
    swagger/error-response.dto.ts          corpos de erro { status, message } e 401 { message }
    swagger/supertokens-paths.ts           rotas do SDK do SuperTokens, descritas à mão
  accounts/
    services/accounts.service.ts           cria a conta no signup e monta o contexto da sessão
    entities/account.entity.ts
    enums/account-role.enum.ts             account_role_e
  professionals/
    controllers/professionals.controller.ts    GET /professionals protegido por sessão
    services/professionals.service.ts          erro seguro, contrato e paginação
    repositories/professionals.repository.ts   query com filtros e paginação
    dto/                                       contratos e validação da consulta
    entities/professional.entity.ts
    enums/specialism.enum.ts                   specialism_e
  patients/
    entities/patient.entity.ts
  auth/
    services/supertokens.service.ts        receitas EmailPassword e Session; campo name no
                                           signup; overrides de signUpPOST, signUp,
                                           signInPOST e createNewSession; signOutPOST desligado
    controllers/auth.controller.ts         GET /me e POST /auth/logout
    dto/logout-request.dto.ts              corpo do logout (allSessions)
    dto/me-response.dto.ts, logout-response.dto.ts   respostas do /me e do logout
    account-context.ts                     valida o payload da sessão
    guards/auth.guard.ts                   adapta o verifySession aos guards do NestJS
    decorators/current-account.decorator.ts   entrega o contexto ao controller
    supertokens-exception.filter.ts        erros do SuperTokens no pipeline do NestJS
  database/
    database.config.ts     conexão e arrays entities/migrations
    data-source.ts         DataSource usado pela CLI do TypeORM
    migrations/            histórico do schema
    seeds/                 dados de desenvolvimento
  health/
    controllers/health.controller.ts       GET /health
    dto/health-response.dto.ts             respostas 200 e 503
test/                      testes e2e
  swagger-plugin-transformer.mjs   plugin do Swagger no ts-jest
```

Cada módulo de domínio separa as camadas em `controllers/`, `services/` e
`repositories/` (repository próprio só quando a query é complexa; senão o
service usa o `Repository<T>` do TypeORM), com os specs ao lado do arquivo.

Entidade ou migration nova precisa entrar nos arrays `entities`/`migrations`
de `src/database/database.config.ts`; senão o TypeORM a ignora.

## Documentação da API

O `@nestjs/swagger` gera o documento a partir dos controllers e DTOs; o
`setupSwagger` é chamado no `main.ts`.

- **Plugin do CLI** (`nest-cli.json`): lê os tipos e os decorators do
  `class-validator` dos arquivos `*.dto.ts`, então os DTOs de entrada não
  repetem `@ApiProperty`. Use `@ApiPropertyOptional` só para o que o plugin
  não deduz (ex.: campo com valor padrão, que ele marcaria como obrigatório).
- **DTOs de resposta são classes**, não `interface`: interface não existe em
  tempo de execução e não aparece no documento.
- **Rota nova**: declare `@ApiTags`, as respostas (`@ApiOkResponse` e os
  erros, com `ErrorResponseDto` ou `UnauthorizedResponseDto`) e, se tiver
  `AuthGuard`, `@ApiCookieAuth()` e `@ApiBearerAuth()`.
- **Testes**: o mesmo plugin roda no ts-jest (`astTransformers`, via
  `test/swagger-plugin-transformer.mjs`), e o `test/swagger.e2e-spec.ts`
  confere o `/docs-json`. Por isso o ts-jest roda com `isolatedModules: false`
  (o plugin precisa do programa TypeScript inteiro) e erro de tipo também
  derruba teste.
- **Rotas do SuperTokens** (`/auth/signup`, `/auth/signin` e
  `/auth/session/refresh`) vêm do middleware, não de controllers, e estão
  escritas à mão em `src/common/swagger/supertokens-paths.ts`. Ao atualizar o
  `supertokens-node`, confira se o contrato delas mudou.
