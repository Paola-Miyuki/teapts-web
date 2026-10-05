# Backend (NestJS)

API do TEAPTS: NestJS + TypeORM + PostgreSQL, com autenticação via
SuperTokens e resolução do contexto de contas armazenado em PostgreSQL.

## Requisitos

- Node >= 22.12 e `pnpm`
- PostgreSQL e SuperTokens no ar (ver `docker-compose.yml` na raiz do repositório)

## Setup

```bash
cp .env.example .env   # preencha DATABASE_PASSWORD
pnpm install
```

O `pnpm install` também registra os hooks do Git: o `prepare` aponta o
`core.hooksPath` para `.husky/` na raiz do repositório, que roda o lint e o
format:check dos dois projetos e um único commitlint na mensagem de commit.

## Variáveis de ambiente

| Variável                     | Uso                                              |
| ---------------------------- | ------------------------------------------------ |
| `PORT`                       | porta HTTP da API (padrão 3000)                  |
| `DATABASE_HOST`              | host do PostgreSQL                               |
| `DATABASE_PORT`              | porta do PostgreSQL                              |
| `DATABASE_USER`              | usuário do PostgreSQL                            |
| `DATABASE_PASSWORD`          | senha do PostgreSQL (só no `.env`)               |
| `DATABASE_NAME`              | nome do banco                                    |
| `WEBSITE_DOMAIN`             | origem do frontend (CORS e SuperTokens)          |
| `API_DOMAIN`                 | domínio público da API (SuperTokens)             |
| `SUPERTOKENS_CONNECTION_URI` | endereço do Core do SuperTokens                  |
| `SUPERTOKENS_API_KEY`        | chave do Core do SuperTokens (vazia em dev)      |
| `SUPERTOKENS_VERSION`        | tag da imagem do SuperTokens no Compose          |

## Banco de dados

O schema só muda por migration (`synchronize` é sempre `false`). Entidades e
migrations são registradas explicitamente em `src/database/database.config.ts`:
entidade ou migration nova que não entrar nos arrays `entities`/`migrations`
desse arquivo é ignorada pelo TypeORM.

Para inspecionar o banco e os atalhos `make`, veja a seção "Banco de dados" do
README da raiz.

```bash
pnpm migration:show                 # lista as migrations ([X] = aplicada)
pnpm migration:run                  # aplica as migrations pendentes
pnpm migration:revert               # desfaz a última migration
pnpm migration:generate src/database/migrations/<Nome>
pnpm seed:test-user                 # cria a conta de teste (teste@teapts.local / teapts123)
```

## Executar

```bash
pnpm start:dev     # watch, na porta PORT (padrão 3000)
pnpm start:prod    # a partir de dist/ (exige pnpm build)
```

## Rotas

As rotas `/auth/*` são fornecidas pelo SDK do SuperTokens:

| Método | Rota                    | Resposta                                                                               |
| ------ | ----------------------- | -------------------------------------------------------------------------------------- |
| GET    | `/health`               | `200 {"status":"ok","database":"up"}` ou `503 {"status":"degraded","database":"down"}` |
| POST   | `/auth/signup`          | Cria usuário no SuperTokens                                                            |
| POST   | `/auth/signin`          | Cria sessão e retorna `OK` ou `WRONG_CREDENTIALS_ERROR`                                |
| POST   | `/auth/session/refresh` | Renova a sessão                                                                        |
| POST   | `/auth/signout`         | Encerra a sessão                                                                       |
| GET    | `/me`                   | Retorna os dados da conta autenticada                                                  |

O frontend deve usar `st-auth-mode: cookie` quando fizer chamadas HTTP
manuais. O SDK web do SuperTokens gerencia os cookies `HttpOnly`.

## Regra de conta órfã

O login só cria uma sessão depois de localizar um registro correspondente
em `accounts.supertokens_user_id`.

Se o usuário existir no SuperTokens, mas não existir em `accounts`, a
criação da sessão é bloqueada e a API retorna `500` com mensagem genérica.
Nenhum cookie de sessão deve ser emitido nesse caso.

## Qualidade

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test          # unitários, não precisam de banco
pnpm test:cov
pnpm test:e2e      # sobe o AppModule e exercita as rotas por HTTP
```

Os testes e2e de autenticação usam mocks do Core do SuperTokens e do serviço
de contas; não precisam de PostgreSQL ou SuperTokens em execução.

## Estrutura

```
src/
  app.module.ts            ConfigModule + TypeOrmModule + módulos da API
  create-app.ts            CORS, middleware e filtros do SuperTokens
  main.ts                  bootstrap e validação da porta
  accounts/                conta vinculada ao usuário do SuperTokens
  auth/                    SuperTokens, guard, decorator e rota /me
  database/
    database.config.ts     opções de conexão a partir do ambiente
    data-source.ts         DataSource usado pela CLI do TypeORM
    entities/              entidades (account)
    enums/                 enums do banco (account_role_e)
    migrations/            histórico do schema
    seeds/                 scripts de dados de desenvolvimento
  health/                  health check
test/                      testes e2e
```

Detalhes do fluxo de autenticação em `DOCS_AUTH.md` e da integração com o
frontend em `DOCS_FRONTEND.md`.
