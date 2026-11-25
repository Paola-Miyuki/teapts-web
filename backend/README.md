# Backend (NestJS)

API do TEA-PTS: NestJS + TypeORM + PostgreSQL, autenticação pelo SuperTokens. Para subir a stack, veja o [README da raiz](../README.md). Swagger: `http://localhost:3000/docs`.

## Scripts

Da raiz: `pnpm --dir backend run <script>`.

| Script                                                     | O que faz                                                                    |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `start:dev` / `build` / `start:prod`                       | API em watch (porta `PORT`, padrão 3000) / compila / roda o `dist/`          |
| `migration:show` / `run` / `revert` / `generate <caminho>` | lista / aplica / desfaz a última / gera a partir das entidades               |
| `seed:test-user`                                           | contas, PTS, medicações e documentos de teste (precisa do SuperTokens no ar) |
| `test` / `test:cov` / `test:e2e`                           | unitários / cobertura / e2e (sem banco nem SuperTokens: ambos são mocks)     |
| `lint` / `typecheck` / `format`                            | ESLint / `tsc --noEmit` / Prettier                                           |

## Variáveis de ambiente

`make env` cria o `.env`; só falta preencher `DATABASE_PASSWORD`. Variáveis: `PORT` (3000), `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_NAME`, `DATABASE_PASSWORD`, `WEBSITE_DOMAIN` (origem do frontend, `http://localhost:3001`), `API_DOMAIN` (base das URLs de envio de arquivo), `STORAGE_TOKEN_SECRET` (opcional e fora do `.env.example`: segredo do token dessas URLs; sem ele, o backend gera um aleatório a cada subida), `STORAGE_UPLOAD_URL_TTL_MINUTES` (validade da URL de envio, padrão 15; a URL de leitura vale 5 minutos), `STORAGE_CLEANUP_INTERVAL_MINUTES` (de quanto em quanto tempo roda a limpeza dos uploads não confirmados, padrão 60) e `STORAGE_UNCONFIRMED_TTL_MINUTES` (idade a partir da qual um upload não confirmado é removido, padrão 1440; precisa ser maior que a validade da URL de envio, senão o backend não sobe), `SUPERTOKENS_CONNECTION_URI` e `SUPERTOKENS_VERSION` (fixe uma). No Docker, o Compose troca o host do banco por `postgres` e o do SuperTokens por `supertokens`.

## Estrutura

Cada módulo separa `controllers/`, `services/` e `repositories/` (mais `dto/`, `entities/`, `enums/`); os specs ficam ao lado do arquivo.

```text
src/
  common/       pagination, search, swagger, validation
  auth/         guards, SuperTokens, /me, signup e login
  accounts/     activities/   patients/     professionals/     pts/     timeline/     health/
  notifications/ avisos da conta (RFNOT002) e rotina diária da janela de reavaliação (RFNOT001, 06:00 de Brasília)
  documents/    URL de envio, confirmação, consulta, URL de leitura e exclusão do documento, DocumentTimelineService, limpeza agendada dos uploads não confirmados (tasks/)
  storage/      StorageService, driver PostgresStorage, token HMAC
  database/     database.config.ts (conexão e arrays entities/migrations), data-source.ts,
                migrations/, seeds/, enums/
test/           e2e (*.e2e-spec.ts)
```

## Rotas

Todas exigem sessão, exceto `GET /health` e `/auth/signup|signin|session/refresh` (SDK do SuperTokens). Corpo e respostas: Swagger. Erros: `{ status, message }`.

| Rota                                                                                         | Acesso                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /auth/logout`, `POST /me/password`                                                     | conta da sessão                                                                                                                                                                                                                                                                                                                                                     |
| `GET, PATCH, DELETE /me`                                                                     | conta da sessão (DELETE desativa a própria conta)                                                                                                                                                                                                                                                                                                                   |
| `GET /accounts`, `GET, DELETE /accounts/:id`                                                 | admin (DELETE desativa e revoga as sessões)                                                                                                                                                                                                                                                                                                                         |
| `GET /patients/authorized`                                                                   | profissional (admin vê todos)                                                                                                                                                                                                                                                                                                                                       |
| `GET /patients`                                                                              | profissional ou admin: pacientes elegíveis para nova proposta                                                                                                                                                                                                                                                                                                       |
| `GET /patients/:id`                                                                          | admin ou profissional com acesso (RN016): cadastro (nascimento, sexo e gênero da conta, endereço, filiação, responsável com telefone, escolaridade, instituição e unidade), histórico clínico, contatos de suporte, `diagnosis` (ficha do PTS atual), `reassessment` (`open` de 30 dias antes da revisão até a data, `overdue` depois, só no PTS ativo) e `hasTcle` |
| `POST /patients`                                                                             | admin                                                                                                                                                                                                                                                                                                                                                               |
| `PATCH /patients/:patientId/clinical-data`                                                   | admin ou membro de PTS ativo (RN024)                                                                                                                                                                                                                                                                                                                                |
| `GET, POST /patients/:patientId/medications`                                                 | ver: com acesso ao paciente; criar: admin ou membro de PTS ativo                                                                                                                                                                                                                                                                                                    |
| `PATCH …/medications/:medicationId`, `POST …/:medicationId/stop`                             | admin ou membro de PTS ativo                                                                                                                                                                                                                                                                                                                                        |
| `GET /patients/:patientId/support-contacts`                                                  | admin, profissional com vínculo ou o próprio paciente                                                                                                                                                                                                                                                                                                               |
| `POST, PATCH, DELETE …/support-contacts[/:contactId]`                                        | admin ou membro de PTS ativo (RN024)                                                                                                                                                                                                                                                                                                                                |
| `GET /professionals`                                                                         | conta da sessão (e-mail só para admin e profissional; `accountId` só para admin, para o `DELETE /accounts/:id`)                                                                                                                                                                                                                                                     |
| `POST /professionals`                                                                        | admin: `accountId`, `specialism`, `councilNumber`, `councilState`; opcionais `institution`, `cnes`                                                                                                                                                                                                                                                                  |
| `PATCH /professionals/:id`                                                                   | admin: `specialism`; com outro conselho, `councilNumber` e `councilState` (mesmo conselho mantém o registro)                                                                                                                                                                                                                                                        |
| `POST /patients/:id/documents/upload-url`                                                    | admin, profissional com PTS ativo ou o paciente: `fileName`, `mimeType`, `sizeBytes` (5 MB)                                                                                                                                                                                                                                                                         |
| `POST /patients/:id/documents`                                                               | mesma autorização: `fileKey` (devolvida pela `uploadUrl`, com o prefixo do paciente), `title`, `category`, `issueDate?`, `issuerAccountId?` (conta de profissional) ou `issuerName?` (no máximo um), `description?`; ativa o objeto e registra `document_uploaded` no PTS ativo; repetir a `fileKey` devolve o documento (`400 UPLOAD_NOT_FOUND`, `403`, `404`)     |
| `PUT /storage/objects/:fileKey?token=`                                                       | sem sessão: o token da `uploadUrl` vale só para o objeto e o tipo (`409` se já enviado)                                                                                                                                                                                                                                                                             |
| `GET /patients/:id/documents`                                                                | admin e profissional vinculado, inclusive com PTS encerrado (o paciente recebe `403`, RN028): `q` (título), `category` (lista separada por vírgula; os termos são `tcle` e `image_authorization`), `page`, `limit`; só metadados, do mais recente ao mais antigo, sem os excluídos (`400 ERROR`, `403`, `404`)                                                      |
| `GET /documents/:id/url`                                                                     | `url` de leitura (vale 5 minutos) e `expiresAt`: admin e profissional vinculado, ou o paciente só do documento que ele enviou (`403`; excluído: `404 DOCUMENT_NOT_FOUND`)                                                                                                                                                                                           |
| `GET /me/documents`                                                                          | paciente titular (`403` para os demais): `q`, `category`, `page`, `limit`; só o que a conta enviou, sem os excluídos                                                                                                                                                                                                                                                |
| `DELETE /documents/:id`                                                                      | só o admin (`403 FORBIDDEN` para os demais): exclusão lógica, grava `deleted_at` e `deleted_by_account_id`, tira o documento das consultas e nega a URL de leitura; o registro e o arquivo (`stored_object`) ficam; registra `document_deleted` no PTS ativo; devolve `id` e `deletedAt` (`401`, `404 DOCUMENT_NOT_FOUND` se não existe ou já foi excluído)         |
| `GET /storage/objects/:fileKey?token=`                                                       | sem sessão: serve o arquivo com o token de leitura da `url` (`download=1` força o anexo; `403 READ_URL_INVALID`, `404 FILE_NOT_FOUND`)                                                                                                                                                                                                                              |
| `POST /pts`                                                                                  | profissional (vira o responsável) ou admin                                                                                                                                                                                                                                                                                                                          |
| `GET /pts`                                                                                   | admin (todos) ou profissional (só os de que é responsável ou membro; o paciente recebe `403`): lista de PTS de todos os estados, com `q` (nome, nome social ou CNS do paciente), `status` (lista), `responsibleId`, `memberId`, `createdFrom`/`createdTo` (AAAA-MM-DD), `sort` (`createdAt` ou `status`), `order`, `page`, `limit`; cada item traz a versão ("2º PTS"), o responsável, a equipe e as datas|
| `GET /pts/proposals[/:id]`                                                                   | paciente titular, profissional da proposta ou admin                                                                                                                                                                                                                                                                                                                 |
| `PATCH, DELETE /pts/proposals/:id`                                                           | responsável ou admin, proposta em `draft`                                                                                                                                                                                                                                                                                                                           |
| `POST /pts/proposals/:id/approve`, `/reject`                                                 | paciente titular ou admin, proposta em `draft`                                                                                                                                                                                                                                                                                                                      |
| `GET /pts/active?patientId=`                                                                 | paciente titular, equipe ou admin                                                                                                                                                                                                                                                                                                                                   |
| `GET /pts/:id`                                                                               | paciente titular (sem a ficha), equipe (menos PTS rejeitado) ou admin                                                                                                                                                                                                                                                                                               |
| `PATCH /pts/:id/sheet`                                                                       | equipe ou admin, PTS ativo; grava `pts_updated` na timeline                                                                                                                                                                                                                                                                                                         |
| `POST /pts/:id/start`                                                                        | responsável ou admin, PTS em `planning`; passa para `running`, grava `began_at` e `pts_started` na timeline (`409 PTS_NOT_PLANNING` fora disso)                                                                                                                                                                                                                     |
| `POST /pts/:id/close`                                                                        | responsável ou admin, PTS em `planning` ou `running`: `outcome` (`concluded` ou `cancelled`), `closingDate` e `reason` opcional; encerra junto as atividades em `running` ou `suspended` e grava `pts_concluded` ou `pts_cancelled` e um evento por atividade na timeline (`409 PTS_NOT_ACTIVE` fora disso)                                                     |
| `POST /pts/:id/team`, `DELETE …/team/:professionalId`, `POST …/team/transfer-responsibility` | responsável ou admin, PTS ativo                                                                                                                                                                                                                                                                                                                                     |
| `GET /pts/:id/activities`                                                                    | paciente titular, equipe (menos PTS rejeitado) ou admin                                                                                                                                                                                                                                                                                                         |
| `POST /pts/:id/activities`                                                                   | equipe ou admin, PTS em `draft`, `planning` ou `running`; nasce `suggested` e grava `activity_suggested` na timeline (`422 INVALID_FREQUENCY`)                                                                                                                                                                                                                  |
| `GET /pts/:id/goals`                                                                         | paciente titular, equipe (menos PTS rejeitado) ou admin                                                                                                                                                                                                                                                                                                             |
| `POST /pts/:id/goals`, `PATCH, DELETE …/goals/:goalId`                                       | equipe ou admin, PTS em `draft`, `planning` ou `running`; grava `goal_added`, `goal_updated` e `goal_removed` na timeline (`409 LAST_GOAL`, `409 GOAL_HAS_ACTIVITIES` na exclusão)                                                                                                                                                                                  |
| `GET /pts/:id/timeline`                                                                      | paciente titular, equipe (menos PTS rejeitado) ou admin                                                                                                                                                                                                                                                                                                             |
| `GET /notifications`, `GET …/unread-count`, `POST …/:id/read`, `POST …/read-all`             | conta da sessão, só as próprias (a de outra conta responde `404`); o admin não recebe                                                                                                                                                                                                                                                                           |
| `GET /health`                                                                                | público (`200` ou `503` com o banco fora)                                                                                                                                                                                                                                                                                                                           |

## Banco de dados

O schema só muda por migration (`synchronize` é `false`). Entidade ou migration nova entra **à mão** nos arrays de `src/database/database.config.ts`, senão o TypeORM a ignora. Schemas: `public` (as tabelas da aplicação, do TypeORM) e `supertokens` (do Core; não mexa).

| Ação                     | Docker (raiz)                                      | Local (`backend/`)                                       |
| ------------------------ | -------------------------------------------------- | -------------------------------------------------------- |
| Ver / aplicar / desfazer | `make migrate-show` / `migrate` / `migrate-revert` | `pnpm migration:show` / `run` / `revert`                 |
| Gerar                    | `make migrate-generate NAME=AddFoo`                | `pnpm migration:generate src/database/migrations/AddFoo` |

Nunca edite migration já aplicada. No Docker, migration nova só vale depois do `make rebuild-backend`. Nomes: colunas em snake_case, enums com sufixo `_e` e restrições com `PK_`, `FK_`, `UQ_`, `IDX_` e `CHK_`.

**Regras do modelo:** uma conta tem no máximo um perfil profissional e um de paciente (RN002), e admin, paciente e profissional usam contas separadas. Excluir é lógico: `account.status = 'inactive'` (RN021) e `deleted_at` na proposta de PTS. O conselho e o nome da especialidade vêm do código (`professionals/professional-registration.ts`); a UF do registro é `uf_e`, em minúsculas. O storage de arquivos é simulado no Postgres (`stored_object`, `bytea`, até 5 MB; só para a demonstração): o `StorageService` é a única porta (envio e leitura passam pelo backend, com token HMAC por objeto) e aceita um driver S3 depois. O documento confirmado vive em `document` (`file_key` única, emissor conta ou texto, `CHK_document_issuer`) e ativa o objeto na mesma transação. Uma tarefa agendada (`setInterval` no `DocumentsModule`, sem `@nestjs/schedule`) remove de `stored_object` os objetos sem a marca `active` e mais antigos que a janela, em lotes de 100 e com log da quantidade; nunca apaga objeto ativo nem com registro em `document`, inclusive excluído, e repetir a rotina não tem efeito sobre o que já foi removido.

**O que o seed cria** (`make seed`, ou `pnpm --dir backend run seed:test-user`; precisa do PostgreSQL e do SuperTokens no ar e das migrations aplicadas). Só para desenvolvimento. As contas são criadas ou reaproveitadas a cada execução; a senha de quem já existe no SuperTokens não é redefinida.

**Administradores** (senha `teapts123`)

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

**Cadastro e histórico clínico dos pacientes** (o seed os regrava a cada execução): os três pacientes recebem tudo o que `paciente.html` mostra: endereço, filiação 1 e 2, responsável tutelar com telefone, escolaridade, instituição de ensino, unidade de referência, os cinco antecedentes e as alergias (Diego, "Nenhuma alergia conhecida"). Quem ainda não tem contato de suporte recebe 2 ou 3, com um de emergência.

**PTS** (um de cada status; só para o paciente que ainda não tem PTS, então rodar de novo não duplica; os PTS que já existem recebem de novo o diagnóstico em comum, achados pela data de criação)

| Paciente          | Status                                               | Responsável           | Equipe                |
| ----------------- | ---------------------------------------------------- | --------------------- | --------------------- |
| Paciente de Teste | `draft` (proposta aguardando o paciente)             | Profissional de Teste | Beatriz Lopes         |
| Luna Ferreira     | `concluded`                                          | Profissional de Teste | —                     |
| Luna Ferreira     | `rejected`                                           | Beatriz Lopes         | —                     |
| Luna Ferreira     | `running` (revisão em 20 dias: "Reavaliação aberta") | Profissional de Teste | Beatriz Lopes         |
| Diego Alves       | `cancelled`                                          | Profissional de Teste | —                     |
| Diego Alves       | `planning` (revisão vencida há 10 dias)              | Beatriz Lopes         | Profissional de Teste |

Cada PTS tem a ficha com o diagnóstico em comum do paciente (CID, nível de suporte, síntese, potencialidades e necessidades prioritárias), mostrado no cartão Diagnóstico.

**Medicações e documentos:** o paciente de teste, Luna e Diego recebem medicações (ativas e suspensas) e documentos em PDF (laudo, exame, receita, relatório, TCLE, autorização de imagem), já ativos no storage. O paciente de teste tem TCLE e a autorização de imagem pendente; Luna tem os dois termos; Diego só a autorização (selo "Sem TCLE"). Cada paciente só os recebe se ainda não tiver medicação ou se o documento (`file_key` `<patientId>/seed-<nome>.pdf`) ainda não existir, então o seed pode rodar de novo.

O seed não cria eventos de timeline, atividades nem atendimentos.

Para testar "Iniciar execução", use o PTS em `planning` do Diego Alves, com a Beatriz Lopes (responsável) ou o admin. Depois de iniciado ele fica em `running`, e o seed não o volta para `planning`.

Para testar "Encerrar", use um PTS em `planning` ou `running` com o responsável ou o admin. O PTS encerrado não volta a ficar ativo, e o seed também não o reabre.

**Conferir e zerar:** `make db-tables`, `db-account`, `db-patients`, `db-professionals`, `db-pts`, `db-query SQL="..."`, `make psql` e `make health`. Zerar: `make clean`, `make up-d`, `make seed` (apaga também usuários e sessões do SuperTokens).

## Rotinas agendadas

Usam o `@nestjs/schedule` e rodam junto com a API; não têm rota.

**Janela de reavaliação** (RFNOT001, `src/notifications/`): todo dia às 06:00 de Brasília, cria em `notification` o aviso dos PTS em `planning` ou `running` com a próxima revisão em até 30 dias.

- **Recebem:** responsável, membros da equipe e paciente titular, com conta ativa. Não recebem: o admin e quem entrou na equipe depois do aviso. PTS encerrado ou já vencido não gera aviso.
- **Sem repetir:** um aviso por destinatário e por data máxima (`UQ_notification_recipient_pts_review`); se a data mudar, sai um aviso novo.
- **Falha:** o erro de um PTS vai para o log, e a rotina segue para os outros.

Para rodar sem esperar o horário (Docker, terminal bash):

```bash
docker exec -i -e DATABASE_HOST=postgres teapts-backend node <<'E'
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const S = './dist/notifications/services/review-window.service';
const { ReviewWindowService } = require(S);
(async () => {
  const opts = { logger: ['error'] };
  const app = await NestFactory.createApplicationContext(AppModule, opts);
  const service = app.get(ReviewWindowService, { strict: false });
  console.log('avisos criados:', await service.notifyReviewWindows());
  await app.close();
  process.exit();
})();
E
```

## Swagger

Gerado dos controllers e DTOs. O plugin do CLI lê os tipos e o `class-validator` dos `*.dto.ts` (DTO de resposta é **classe**, não `interface`). Rota nova: `@ApiTags`, as respostas (`ErrorResponseDto` nos erros) e, com `AuthGuard`, `@ApiCookieAuth()` e `@ApiBearerAuth()`. O `test/swagger.e2e-spec.ts` confere o `/docs-json`. As rotas do SDK estão à mão em `src/common/swagger/supertokens-paths.ts`.
