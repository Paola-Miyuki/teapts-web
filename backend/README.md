# Backend (NestJS)

API do TEA-PTS: NestJS + TypeORM + PostgreSQL, autenticação pelo SuperTokens. Para subir a stack, veja o [README da raiz](../README.md). Swagger: `http://localhost:3000/docs`.

## Scripts

Da raiz: `pnpm --dir backend run <script>`.

| Script                                                     | O que faz                                                                |
| ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| `start:dev` / `build` / `start:prod`                       | API em watch (porta `PORT`, padrão 3000) / compila / roda o `dist/`      |
| `migration:show` / `run` / `revert` / `generate <caminho>` | lista / aplica / desfaz a última / gera a partir das entidades           |
| `seed:test-user`                                           | contas e PTS de teste (precisa do SuperTokens no ar)                     |
| `test` / `test:cov` / `test:e2e`                           | unitários / cobertura / e2e (sem banco nem SuperTokens: ambos são mocks) |
| `lint` / `typecheck` / `format`                            | ESLint / `tsc --noEmit` / Prettier                                       |

## Variáveis de ambiente

`make env` cria o `.env`; só falta preencher `DATABASE_PASSWORD`. Variáveis: `PORT` (3000), `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_NAME`, `DATABASE_PASSWORD`, `WEBSITE_DOMAIN` (origem do frontend, `http://localhost:3001`), `API_DOMAIN`, `SUPERTOKENS_CONNECTION_URI`, `SUPERTOKENS_API_KEY` e `SUPERTOKENS_VERSION` (fixe uma). No Docker, o Compose troca o host do banco por `postgres` e o do SuperTokens por `supertokens`.

## Estrutura

Cada módulo separa `controllers/`, `services/` e `repositories/` (mais `dto/`, `entities/`, `enums/`); os specs ficam ao lado do arquivo.

```text
src/
  common/       pagination, search, swagger, validation
  auth/         guards, SuperTokens, /me, signup e login
  accounts/     patients/     professionals/     pts/     timeline/     health/
  database/     database.config.ts (conexão e arrays entities/migrations), data-source.ts,
                migrations/, seeds/, enums/
test/           e2e (*.e2e-spec.ts)
```

## Rotas

Todas exigem sessão, exceto `GET /health` e `/auth/signup|signin|session/refresh` (SDK do SuperTokens). Corpo e respostas: Swagger. Erros: `{ status, message }`.

| Rota                                                                                         | Acesso                                                                                             |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `POST /auth/logout`, `POST /me/password`                                                     | conta da sessão                                                                                    |
| `GET, PATCH, DELETE /me`                                                                     | conta da sessão (DELETE desativa a própria conta)                                                  |
| `GET /accounts`, `GET, DELETE /accounts/:id`                                                 | admin (DELETE desativa e revoga as sessões)                                                        |
| `GET /patients/authorized`                                                                   | profissional (admin vê todos)                                                                      |
| `GET /patients`                                                                              | profissional ou admin: pacientes elegíveis para nova proposta                                      |
| `GET /patients/:id`                                                                          | admin ou profissional com acesso (RN016)                                                           |
| `POST /patients`                                                                             | admin                                                                                              |
| `PATCH /patients/:patientId/clinical-data`                                                   | admin ou membro de PTS ativo (RN024)                                                               |
| `GET, POST /patients/:patientId/medications`                                                 | ver: com acesso ao paciente; criar: admin ou membro de PTS ativo                                   |
| `PATCH …/medications/:medicationId`, `POST …/:medicationId/stop`                             | admin ou membro de PTS ativo                                                                       |
| `GET /patients/:patientId/support-contacts`                                                  | admin, profissional com vínculo ou o próprio paciente                                              |
| `POST, PATCH, DELETE …/support-contacts[/:contactId]`                                        | admin ou membro de PTS ativo (RN024)                                                               |
| `GET /professionals`                                                                         | conta da sessão (e-mail só para admin e profissional)                                              |
| `POST /professionals`                                                                        | admin: `accountId`, `specialism`, `councilNumber`, `councilState`; opcionais `institution`, `cnes` |
| `POST /pts`                                                                                  | profissional (vira o responsável) ou admin                                                         |
| `GET /pts/proposals[/:id]`                                                                   | paciente titular, profissional da proposta ou admin                                                |
| `PATCH, DELETE /pts/proposals/:id`                                                           | responsável ou admin, proposta em `draft`                                                          |
| `POST /pts/proposals/:id/approve`, `/reject`                                                 | paciente titular ou admin, proposta em `draft`                                                     |
| `GET /pts/active?patientId=`                                                                 | paciente titular, equipe ou admin                                                                  |
| `GET /pts/:id`                                                                               | paciente titular (sem a ficha), equipe (menos PTS rejeitado) ou admin                              |
| `PATCH /pts/:id/sheet`                                                                       | equipe ou admin, PTS ativo; grava `pts_updated` na timeline                                        |
| `POST /pts/:id/team`, `DELETE …/team/:professionalId`, `POST …/team/transfer-responsibility` | responsável ou admin, PTS ativo                                                                    |
| `GET /pts/:id/timeline`                                                                      | paciente titular, equipe (menos PTS rejeitado) ou admin                                            |
| `GET /health`                                                                                | público (`200` ou `503` com o banco fora)                                                          |

## Banco de dados

O schema só muda por migration (`synchronize` é `false`). Entidade ou migration nova entra **à mão** nos arrays de `src/database/database.config.ts`, senão o TypeORM a ignora. Schemas: `public` (as tabelas da aplicação, do TypeORM) e `supertokens` (do Core; não mexa).

| Ação                     | Docker (raiz)                                      | Local (`backend/`)                                       |
| ------------------------ | -------------------------------------------------- | -------------------------------------------------------- |
| Ver / aplicar / desfazer | `make migrate-show` / `migrate` / `migrate-revert` | `pnpm migration:show` / `run` / `revert`                 |
| Gerar                    | `make migrate-generate NAME=AddFoo`                | `pnpm migration:generate src/database/migrations/AddFoo` |

Nunca edite migration já aplicada. No Docker, migration nova só vale depois do `make rebuild-backend`. Nomes: colunas em snake_case, enums com sufixo `_e` e restrições com `PK_`, `FK_`, `UQ_`, `IDX_` e `CHK_`.

**Regras do modelo:** uma conta tem no máximo um perfil profissional e um de paciente (RN002), e admin, paciente e profissional usam contas separadas. Excluir é lógico: `account.status = 'inactive'` (RN021) e `deleted_at` na proposta de PTS. O conselho e o nome da especialidade vêm do código (`professionals/professional-registration.ts`); a UF do registro é `uf_e`, em minúsculas.

**Contas de teste** (`make seed`; só para desenvolvimento):

| Conta         | E-mail / senha                                                                               |
| ------------- | -------------------------------------------------------------------------------------------- |
| Admin         | `teste@teapts.local` / `teapts123`                                                           |
| Profissionais | `profissional@teapts.local`, `fisioterapeuta@teapts.local` / `profissional123`               |
| Pacientes     | `paciente@`, `luna@`, `diego@teapts.local` / `paciente123`                                   |
| Sem perfil    | `bruno@`, `priscila@`, `sofia@`, `marcela@`, `helena@` (inativa) `teapts.local` / `conta123` |

O seed cria um PTS de cada status e não duplica ao rodar de novo.

**Conferir e zerar:** `make db-tables`, `db-account`, `db-patients`, `db-professionals`, `db-pts`, `db-query SQL="..."`, `make psql` e `make health`. Zerar: `make clean`, `make up-d`, `make seed` (apaga também usuários e sessões do SuperTokens).

## Swagger

Gerado dos controllers e DTOs. O plugin do CLI lê os tipos e o `class-validator` dos `*.dto.ts` (DTO de resposta é **classe**, não `interface`). Rota nova: `@ApiTags`, as respostas (`ErrorResponseDto` nos erros) e, com `AuthGuard`, `@ApiCookieAuth()` e `@ApiBearerAuth()`. O `test/swagger.e2e-spec.ts` confere o `/docs-json`. As rotas do SDK estão à mão em `src/common/swagger/supertokens-paths.ts`.
