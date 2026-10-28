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
    pagination/pagination-query.dto.ts     page/limit da query (padrão 1 e 20, máximo 50)
    pagination/pagination.ts               bloco pagination da resposta (toPagination)
  accounts/
    controllers/accounts.controller.ts     GET /accounts, só admin
    services/accounts.service.ts           cria a conta no signup, monta o contexto da sessão
                                           e lista as contas
    repositories/accounts.repository.ts    query da listagem com filtros e paginação
    dto/                                   contratos e validação da listagem
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
    controllers/patients.controller.ts         GET /patients/authorized protegido por sessão
                                               e POST /patients, só admin
    services/patients.service.ts               consulta (erro seguro, contrato e paginação)
                                               e cadastro do perfil de paciente
    repositories/patients.repository.ts        query de autorização e paginação; gravação do
                                               perfil (supportContacts como jsonb[])
    dto/                                       contratos e validação da consulta e do cadastro
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
    guards/admin.guard.ts                  depois do AuthGuard, exige o papel admin (403)
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

## GET /patients/authorized

Exige sessão autenticada e lista pacientes vinculados a PTS em estado
`planning` ou `running` (`PtsStateEnum`), nos quais o profissional logado é
responsável ou participa da equipe. **Atenção**: desde o PR #68 esse filtro
está comentado em `patients.repository.ts`, e a rota lista todos os pacientes.

Parâmetros de query:

- `page`: página, padrão `1`, mínimo `1`;
- `limit`: quantidade por página, padrão `10`, mínimo `1` e máximo `100`.

Não usa a paginação de `common/pagination` (máximo `50`) porque o `pts/novo`
pede `limit=100`.

A resposta contém `{ data: [{ id, name }], pagination: { page, limit, total,
totalPages } }`; `id` é um UUID (`string`). Os erros possíveis são `400`
(`Parâmetro inválido: X`), `401` (sem sessão) e `500`
(`Não foi possível consultar os pacientes autorizados.`).

## GET /accounts

Exige sessão autenticada com papel `admin` e lista as contas para escolher a
conta (ex.: no cadastro de perfil de paciente), ordenadas por nome.

Parâmetros de query:

- `isPatient`: `true` só contas com perfil de paciente, `false` só contas sem;
  opcional;
- `isProfessional`: `true` só contas com perfil profissional, `false` só
  contas sem; opcional;
- `page`: página, padrão `1`, mínimo `1`;
- `limit`: quantidade por página, padrão `20`, mínimo `1` e máximo `50`.

Sem filtros, lista todas as contas. A resposta contém `{ data: [{ id, name }],
pagination: { page, limit, total, totalPages } }`. Os erros possíveis são
`400` (`{ status: 'ERROR', message: 'Parâmetro inválido: X' }`), `401` (sem
sessão), `403` (`FORBIDDEN`, conta sem papel `admin`) e `500`
(`Não foi possível consultar as contas.`).

## POST /patients

Exige sessão autenticada com papel `admin` e cria o perfil de paciente de uma
conta existente (RFPAC001). Uma conta tem no máximo um perfil de paciente
(RN002); contato de suporte não concede tutela (RN017).

Corpo:

```json
{
  "accountId": "0b6f5a4e-2c1d-4e8f-9a7b-3c2d1e0f9a8b",
  "supportContacts": [
    { "name": "Maria Martins", "description": "Mãe", "email": "maria@exemplo.com", "phone": "(11) 98765-4321" }
  ]
}
```

`supportContacts` é opcional (ausente vira `[]`); em cada contato só `name` é
obrigatório e `email`, quando informado, precisa ser válido. Os textos são
salvos sem espaços externos, e campos opcionais vazios são descartados.

Responde `201` com `{ accountId, supportContacts }`. Os erros possíveis são
`400` (`VALIDATION_ERROR`, com a mensagem do campo), `401` (sem sessão), `403`
(`FORBIDDEN`), `404` (`ACCOUNT_NOT_FOUND`), `409`
(`PATIENT_PROFILE_ALREADY_EXISTS`, também em pedidos simultâneos) e `500`
(`Não foi possível cadastrar o perfil de paciente.`).

O `patientProfileId` da sessão vem do access token: a conta que recebeu o
perfil só aparece como paciente depois de um novo login.

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
- **Paginação**: a query de uma listagem nova estende o `PaginationQueryDto`
  (`common/pagination`), que já documenta `page` e `limit`; a resposta usa o
  `PaginationResponseDto` e o `toPagination`.
- **Testes**: o mesmo plugin roda no ts-jest (`astTransformers`, via
  `test/swagger-plugin-transformer.mjs`), e o `test/swagger.e2e-spec.ts`
  confere o `/docs-json`. Por isso o ts-jest roda com `isolatedModules: false`
  (o plugin precisa do programa TypeScript inteiro) e erro de tipo também
  derruba teste.
- **Rotas do SuperTokens** (`/auth/signup`, `/auth/signin` e
  `/auth/session/refresh`) vêm do middleware, não de controllers, e estão
  escritas à mão em `src/common/swagger/supertokens-paths.ts`. Ao atualizar o
  `supertokens-node`, confira se o contrato delas mudou.