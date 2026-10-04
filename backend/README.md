# Backend (NestJS)

API do TEAPTS: NestJS + TypeORM + PostgreSQL.

## Requisitos

- Node >= 22.12 e `pnpm`
- PostgreSQL no ar (ver `docker-compose.yml` na raiz do repositório)

## Setup

```bash
cp .env.example .env   # preencha DATABASE_PASSWORD
pnpm install
```

O `pnpm install` também registra os hooks do Git: o `prepare` aponta o
`core.hooksPath` para `.husky/` na raiz do repositório, que roda o lint e o
format:check dos dois projetos e um único commitlint na mensagem de commit.

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

| Método | Rota      | Resposta                                                     |
| ------ | --------- | ------------------------------------------------------------ |
| GET    | `/health` | `200 {"status":"ok","database":"up"}` ou `503 {"status":"degraded","database":"down"}` |

## Qualidade

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test          # unitários, não precisam de banco
pnpm test:cov
pnpm test:e2e      # sobe o AppModule e exercita as rotas por HTTP
```

## Estrutura

```
src/
  app.module.ts            ConfigModule + TypeOrmModule + HealthModule
  main.ts                  bootstrap e validação da porta
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
