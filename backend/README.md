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

`make env` cria o `.env`; só falta preencher `DATABASE_PASSWORD`. Variáveis: `PORT` (3000), `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_NAME`, `DATABASE_PASSWORD`, `WEBSITE_DOMAIN` (origem do frontend, `http://localhost:3001`), `API_DOMAIN` (base das URLs de envio de arquivo), `STORAGE_TOKEN_SECRET` (opcional e fora do `.env.example`: segredo do token dessas URLs; sem ele, o backend gera um aleatório a cada subida), `STORAGE_UPLOAD_URL_TTL_MINUTES` (validade, padrão 15), `SUPERTOKENS_CONNECTION_URI` e `SUPERTOKENS_VERSION` (fixe uma). No Docker, o Compose troca o host do banco por `postgres` e o do SuperTokens por `supertokens`.

## Estrutura

Cada módulo separa `controllers/`, `services/` e `repositories/` (mais `dto/`, `entities/`, `enums/`); os specs ficam ao lado do arquivo.

```text
src/
  common/       pagination, search, swagger, validation
  auth/         guards, SuperTokens, /me, signup e login
  accounts/     patients/     professionals/     pts/     timeline/     health/
  documents/    storage/ (StorageService, driver PostgresStorage, token HMAC)
  database/     database.config.ts (conexão e arrays entities/migrations), data-source.ts,
                migrations/, seeds/, enums/
test/           e2e (*.e2e-spec.ts)
```

## Rotas

Todas exigem sessão, exceto `GET /health` e `/auth/signup|signin|session/refresh` (SDK do SuperTokens). Corpo e respostas: Swagger. Erros: `{ status, message }`.

| Rota                                                                                         | Acesso                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /auth/logout`, `POST /me/password`                                                     | conta da sessão                                                                                                                                                                    |
| `GET, PATCH, DELETE /me`                                                                     | conta da sessão (DELETE desativa a própria conta)                                                                                                                                  |
| `GET /accounts`, `GET, DELETE /accounts/:id`                                                 | admin (DELETE desativa e revoga as sessões)                                                                                                                                        |
| `GET /patients/authorized`                                                                   | profissional (admin vê todos)                                                                                                                                                      |
| `GET /patients`                                                                              | profissional ou admin: pacientes elegíveis para nova proposta                                                                                                                      |
| `GET /patients/:id`                                                                          | admin ou profissional com acesso (RN016)                                                                                                                                           |
| `POST /patients`                                                                             | admin                                                                                                                                                                              |
| `PATCH /patients/:patientId/clinical-data`                                                   | admin ou membro de PTS ativo (RN024)                                                                                                                                               |
| `GET, POST /patients/:patientId/medications`                                                 | ver: com acesso ao paciente; criar: admin ou membro de PTS ativo                                                                                                                   |
| `PATCH …/medications/:medicationId`, `POST …/:medicationId/stop`                             | admin ou membro de PTS ativo                                                                                                                                                       |
| `GET /patients/:patientId/support-contacts`                                                  | admin, profissional com vínculo ou o próprio paciente                                                                                                                              |
| `POST, PATCH, DELETE …/support-contacts[/:contactId]`                                        | admin ou membro de PTS ativo (RN024)                                                                                                                                               |
| `GET /professionals`                                                                         | conta da sessão (e-mail só para admin e profissional; `accountId` só para admin, para o `DELETE /accounts/:id`)                                                                    |
| `POST /professionals`                                                                        | admin: `accountId`, `specialism`, `councilNumber`, `councilState`; opcionais `institution`, `cnes`                                                                                 |
| `PATCH /professionals/:id`                                                                   | admin: `specialism`; com outro conselho, `councilNumber` e `councilState` (mesmo conselho mantém o registro)                                                                       |
| `POST /patients/:id/documents/upload-url`                                                    | admin, profissional com PTS ativo ou o paciente: `fileName`, `mimeType`, `sizeBytes` (5 MB)                                                                                        |
| `PUT /storage/objects/:fileKey?token=`                                                       | sem sessão: o token da `uploadUrl` vale só para o objeto e o tipo (`409` se já enviado)                                                                                            |
| `POST /pts`                                                                                  | profissional (vira o responsável) ou admin                                                                                                                                         |
| `GET /pts/proposals[/:id]`                                                                   | paciente titular, profissional da proposta ou admin                                                                                                                                |
| `PATCH, DELETE /pts/proposals/:id`                                                           | responsável ou admin, proposta em `draft`                                                                                                                                          |
| `POST /pts/proposals/:id/approve`, `/reject`                                                 | paciente titular ou admin, proposta em `draft`                                                                                                                                     |
| `GET /pts/active?patientId=`                                                                 | paciente titular, equipe ou admin                                                                                                                                                  |
| `GET /pts/:id`                                                                               | paciente titular (sem a ficha), equipe (menos PTS rejeitado) ou admin                                                                                                              |
| `PATCH /pts/:id/sheet`                                                                       | equipe ou admin, PTS ativo; grava `pts_updated` na timeline                                                                                                                        |
| `POST /pts/:id/start`                                                                        | responsável ou admin, PTS em `planning`; passa para `running`, grava `began_at` e `pts_started` na timeline (`409 PTS_NOT_PLANNING` fora disso)                                    |
| `POST /pts/:id/team`, `DELETE …/team/:professionalId`, `POST …/team/transfer-responsibility` | responsável ou admin, PTS ativo                                                                                                                                                    |
| `GET /pts/:id/goals`                                                                         | paciente titular, equipe (menos PTS rejeitado) ou admin                                                                                                                            |
| `POST /pts/:id/goals`, `PATCH, DELETE …/goals/:goalId`                                       | equipe ou admin, PTS em `draft`, `planning` ou `running`; grava `goal_added`, `goal_updated` e `goal_removed` na timeline (`409 LAST_GOAL`, `409 GOAL_HAS_ACTIVITIES` na exclusão) |
| `GET /pts/:id/timeline`                                                                      | paciente titular, equipe (menos PTS rejeitado) ou admin                                                                                                                            |
| `GET /health`                                                                                | público (`200` ou `503` com o banco fora)                                                                                                                                          |

## Banco de dados

O schema só muda por migration (`synchronize` é `false`). Entidade ou migration nova entra **à mão** nos arrays de `src/database/database.config.ts`, senão o TypeORM a ignora. Schemas: `public` (as tabelas da aplicação, do TypeORM) e `supertokens` (do Core; não mexa).

| Ação                     | Docker (raiz)                                      | Local (`backend/`)                                       |
| ------------------------ | -------------------------------------------------- | -------------------------------------------------------- |
| Ver / aplicar / desfazer | `make migrate-show` / `migrate` / `migrate-revert` | `pnpm migration:show` / `run` / `revert`                 |
| Gerar                    | `make migrate-generate NAME=AddFoo`                | `pnpm migration:generate src/database/migrations/AddFoo` |

Nunca edite migration já aplicada. No Docker, migration nova só vale depois do `make rebuild-backend`. Nomes: colunas em snake_case, enums com sufixo `_e` e restrições com `PK_`, `FK_`, `UQ_`, `IDX_` e `CHK_`.

**Regras do modelo:** uma conta tem no máximo um perfil profissional e um de paciente (RN002), e admin, paciente e profissional usam contas separadas. Excluir é lógico: `account.status = 'inactive'` (RN021) e `deleted_at` na proposta de PTS. O conselho e o nome da especialidade vêm do código (`professionals/professional-registration.ts`); a UF do registro é `uf_e`, em minúsculas. O storage de arquivos é simulado no Postgres (`stored_object`, `bytea`, até 5 MB; só para a demonstração): o `StorageService` é a única porta e aceita um driver S3 depois.

**O que o seed cria** (`make seed`, ou `pnpm --dir backend run seed:test-user`; precisa do PostgreSQL e do SuperTokens no ar e das migrations aplicadas). Só para desenvolvimento. As contas são criadas ou reaproveitadas a cada execução; a senha de quem já existe no SuperTokens não é redefinida.

**Administradores**

- `teste@teapts.local` / `teapts123`: papel `admin`; sem CPF nem dados pessoais (RN001)
- `maria.admin@teapts.local` / `teapts123`: Maria Santos, segundo admin, sem CPF nem perfil

**Profissionais** (senha `profissional123`)

- `profissional@teapts.local`: Profissional de Teste, psicólogo, `CRP-PR 12345`, IMA, CNES `2771112`; CPF `123.456.789-09`, 12/06/1988, feminino
- `fisioterapeuta@teapts.local`: Beatriz Lopes, fisioterapeuta, `Crefito-PR 54321`, CER Curitiba; CPF `222.333.444-05`, 03/09/1985, feminino

**Pacientes** (senha `paciente123`)

- `paciente@teapts.local`: Paciente de Teste, CNS `700 0012 3456 7894`; CPF `987.654.321-00`, 18/04/2000, masculino
- `luna@teapts.local`: Luna Ferreira, CNS `700 0022 2333 4444`; CPF `111.444.777-35`, 15/03/2007, feminino
- `diego@teapts.local`: Diego Alves, menor de idade, responsável tutelar Paula Alves, CNS `700 0055 5666 7777`; CPF `321.654.987-91`, 22/08/2015, masculino

**Contas sem perfil** (senha `conta123`, para a tela Contas; a situação volta ao valor abaixo a cada seed)

- `bruno@teapts.local`: Bruno Takeda, ativa; CPF `390.533.447-05`, criada em 10/11/2026
- `priscila@teapts.local`: Priscila Martins, ativa; CPF `529.982.247-25`, criada em 14/11/2026
- `sofia@teapts.local`: Sofia Andrade, ativa, sem telefone; CPF `168.995.350-09`, criada em 30/08/2026
- `marcela@teapts.local`: Marcelo Duarte, ativa, nome social "Marcela Duarte" (a lista mostra e busca por ele); CPF `135.792.468-28`, criada em 02/10/2026
- `helena@teapts.local`: Helena Rocha, **inativa** (desativada em 01/09/2026); CPF `246.813.579-28`, criada em 17/04/2026

**PTS** (um de cada status; só para o paciente que ainda não tem PTS, então rodar de novo não duplica)

| Paciente          | Status                                   | Responsável           | Equipe                |
| ----------------- | ---------------------------------------- | --------------------- | --------------------- |
| Paciente de Teste | `draft` (proposta aguardando o paciente) | Profissional de Teste | Beatriz Lopes         |
| Luna Ferreira     | `concluded`                              | Profissional de Teste | —                     |
| Luna Ferreira     | `rejected`                               | Beatriz Lopes         | —                     |
| Luna Ferreira     | `running`                                | Profissional de Teste | Beatriz Lopes         |
| Diego Alves       | `cancelled`                              | Profissional de Teste | —                     |
| Diego Alves       | `planning`                               | Beatriz Lopes         | Profissional de Teste |

O seed não cria medicações, contatos de suporte, dados clínicos nem eventos de timeline.

Para testar "Iniciar execução", use o PTS em `planning` do Diego Alves, com a Beatriz Lopes (responsável) ou o admin. Depois de iniciado ele fica em `running`, e o seed não o volta para `planning`.

**Conferir e zerar:** `make db-tables`, `db-account`, `db-patients`, `db-professionals`, `db-pts`, `db-query SQL="..."`, `make psql` e `make health`. Zerar: `make clean`, `make up-d`, `make seed` (apaga também usuários e sessões do SuperTokens).

## Swagger

Gerado dos controllers e DTOs. O plugin do CLI lê os tipos e o `class-validator` dos `*.dto.ts` (DTO de resposta é **classe**, não `interface`). Rota nova: `@ApiTags`, as respostas (`ErrorResponseDto` nos erros) e, com `AuthGuard`, `@ApiCookieAuth()` e `@ApiBearerAuth()`. O `test/swagger.e2e-spec.ts` confere o `/docs-json`. As rotas do SDK estão à mão em `src/common/swagger/supertokens-paths.ts`.
