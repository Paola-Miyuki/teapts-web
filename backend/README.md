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
| `seed:test-user`                     | cria as contas de teste (admin, profissionais e pacientes) e os PTS de teste; precisa do SuperTokens no ar |
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
    controllers/accounts.controller.ts     GET /accounts, GET /accounts/:id e DELETE /accounts/:id, só admin
    services/accounts.service.ts           cria a conta no signup, monta o contexto da sessão,
                                           lista as contas, detalha uma conta e desativa a conta (revoga as sessões)
    repositories/accounts.repository.ts    query da listagem (perfil, situação, data, ordenação) com busca e paginação;
                                           transação da desativação
    dto/                                   contratos e validação da listagem
    entities/account.entity.ts
    enums/                                 account_role_e, account_status_e, sex_e e gender_e
  professionals/
    controllers/professionals.controller.ts    GET /professionals protegido por sessão
                                               e POST /professionals, só admin
    services/professionals.service.ts          consulta (erro seguro, contrato e paginação)
                                               e cadastro do perfil profissional
    repositories/professionals.repository.ts   query com filtros e paginação; gravação
                                               do perfil
    dto/                                       contratos e validação da consulta e do cadastro
    entities/professional.entity.ts            unique (account_id): um perfil por conta
    enums/specialism.enum.ts                   specialism_e
  patients/
    controllers/patients.controller.ts         GET /patients/authorized,
                                               GET /patients/available-for-pts e
                                               GET /patients/:id protegidos por
                                               sessão, POST /patients, só admin, e os
                                               contatos de suporte contato a contato
                                               (/patients/:patientId/support-contacts)
    services/patients.service.ts               escopo por papel (RN016, RN022), contrato,
                                               erro seguro e cadastro do perfil de paciente
    repositories/patients.repository.ts        lista com status do PTS, busca, filtros,
                                               ordenação e paginação; detalhe; gravação do
                                               perfil e dos contatos numa transação
    dto/                                       contratos e validação da consulta, do cadastro e dos contatos
    entities/patient.entity.ts                 FK para account com ON DELETE RESTRICT
    entities/support-contact.entity.ts         contatos de suporte (tabela support_contact)
  pts/
    controllers/pts.controller.ts              POST /pts, GET /pts/proposals, GET /pts/proposals/:id,
                                               GET /pts/active, GET /pts/:id, PATCH /pts/proposals/:id,
                                               PATCH /pts/:id/social-situation, POST
                                               /pts/proposals/:id/approve e /reject,
                                               DELETE /pts/proposals/:id e
                                               DELETE /pts/:id/team/:professionalId, todos com sessão
    services/pts.service.ts                    regras de acesso (paciente titular, responsável,
                                               equipe e admin), estados do PTS e decisão das propostas
    repositories/pts.repository.ts             contrato do repositório (implementação em
                                               pts.repository.impl.ts)
    dto/                                       contratos e validação de criação, consulta,
                                               edição, situação social e decisão
    entities/pts.entity.ts                     projeto_terapeutico_singular e a equipe (pts_state_e);
                                               deleted_at é a exclusão lógica da proposta
    pts.errors.ts                              erros { status, message } do módulo
  timeline/
    entities/timeline-record.entity.ts         timeline_record (eventos do PTS)
    enums/                                     timeline_record_type_e e timeline_record_target_e
  auth/
    services/supertokens.service.ts        receitas EmailPassword e Session; campos da conta no
                                           signup; overrides de signUpPOST, signUp,
                                           signInPOST e createNewSession; signOutPOST desligado
    sign-up-fields.ts                      validação e leitura dos campos do signup (CPF com
                                           dígito verificador, data, sexo, gênero, telefone)
    controllers/auth.controller.ts         GET /me, PATCH /me, DELETE /me, POST /me/password e POST /auth/logout
    dto/logout-request.dto.ts              corpo do logout (allSessions)
    dto/me-response.dto.ts, logout-response.dto.ts   respostas do /me e do logout
    account-context.ts                     valida o payload da sessão
    guards/auth.guard.ts                   adapta o verifySession aos guards do NestJS e recusa conta inativa (401)
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

## Rotas

Todas exigem sessão, exceto `GET /health` e as rotas do SuperTokens (seção 6
do [README da raiz](../README.md)). O contrato completo de cada rota está no
Swagger (`/docs`); as seções abaixo detalham as que têm regra própria.

| Método | Rota | Acesso | Detalhe |
| --- | --- | --- | --- |
| GET | `/health` | público | README da raiz, 5.3 |
| GET | `/me` | conta da sessão | README da raiz, 6.3 |
| PATCH | `/me` | conta da sessão | [PATCH /me](#patch-me) |
| POST | `/me/password` | conta da sessão | [POST /me/password](#post-mepassword) |
| POST | `/auth/logout` | conta da sessão | README da raiz, 6.3 |
| GET | `/accounts` | admin | [GET /accounts](#get-accounts) |
| GET | `/accounts/:id` | admin | [GET /accounts/:id](#get-accountsid) |
| DELETE | `/accounts/:id` | admin | [DELETE /me e DELETE /accounts/:id](#delete-me-e-delete-accountsid) |
| DELETE | `/me` | conta da sessão | [DELETE /me e DELETE /accounts/:id](#delete-me-e-delete-accountsid) |
| GET | `/patients/authorized` | profissional (admin vê todos os pacientes) | [GET /patients/authorized](#get-patientsauthorized) |
| GET | `/patients/available-for-pts` | profissional ou admin | [GET /patients/available-for-pts](#get-patientsavailable-for-pts) |
| GET | `/patients/:id` | admin ou profissional com acesso (RN016) | [GET /patients/:id](#get-patientsid) |
| POST | `/patients` | admin | [POST /patients](#post-patients) |
| GET | `/patients/:patientId/support-contacts` | admin, profissional com vínculo (RN016) ou o próprio paciente | [Contatos de suporte](#contatos-de-suporte) |
| POST | `/patients/:patientId/support-contacts` | admin ou membro de PTS ativo do paciente (RN024) | [Contatos de suporte](#contatos-de-suporte) |
| PATCH | `/patients/:patientId/support-contacts/:contactId` | admin ou membro de PTS ativo do paciente | [Contatos de suporte](#contatos-de-suporte) |
| DELETE | `/patients/:patientId/support-contacts/:contactId` | admin ou membro de PTS ativo do paciente | [Contatos de suporte](#contatos-de-suporte) |
| GET | `/patients/:patientId/support-contacts` | admin, profissional com vínculo (RN016) ou o próprio paciente | [Contatos de suporte](#contatos-de-suporte) |
| POST | `/patients/:patientId/support-contacts` | admin ou membro de PTS ativo do paciente (RN024) | [Contatos de suporte](#contatos-de-suporte) |
| PATCH | `/patients/:patientId/support-contacts/:contactId` | admin ou membro de PTS ativo do paciente (RN024) | [Contatos de suporte](#contatos-de-suporte) |
| DELETE | `/patients/:patientId/support-contacts/:contactId` | admin ou membro de PTS ativo do paciente (RN024) | [Contatos de suporte](#contatos-de-suporte) |
| GET | `/professionals` | conta da sessão (o e-mail só para admin e profissional) | Swagger; cada item traz `registration` (`{ council, number, state }`, com o conselho vindo da especialidade, ou `null`), `institution` e `cnes` |
| POST | `/professionals` | admin | [POST /professionals](#post-professionals) |
| POST | `/pts` | profissional (o perfil informado vira o responsável) ou admin (qualquer profissional) | Swagger |
| GET | `/pts/proposals` | paciente titular, profissional da proposta ou admin | [GET /pts/proposals](#get-ptsproposals) |
| GET | `/pts/proposals/:id` | paciente titular, profissional da proposta ou admin | Swagger |
| GET | `/pts/active?patientId=` | paciente titular, membro da equipe ou admin | [GET /pts/active](#get-ptsactive) |
| GET | `/pts/:id` | paciente titular, equipe (menos PTS rejeitado) ou admin | [GET /pts/:id](#get-ptsid) |
| PATCH | `/pts/proposals/:id` | responsável ou admin, proposta em `draft` | [PATCH /pts/proposals/:id](#patch-ptsproposalsid) |
| DELETE | `/pts/proposals/:id` | responsável ou admin, proposta em `draft` | [DELETE /pts/proposals/:id](#delete-ptsproposalsid) |
| DELETE | `/pts/:id/team/:professionalId` | responsável ou admin, PTS em `planning` ou `running` | [DELETE /pts/:id/team/:professionalId](#delete-ptsidteamprofessionalid) |
| PATCH | `/pts/:id/social-situation` | membro da equipe ou admin, PTS em `planning` ou `running` | Swagger |
| POST | `/pts/proposals/:id/approve` | paciente titular ou admin, proposta em `draft` | [POST /pts/proposals/:id/approve e /reject](#post-ptsproposalsidapprove-e-reject) |
| POST | `/pts/proposals/:id/reject` | paciente titular ou admin, proposta em `draft` | [POST /pts/proposals/:id/approve e /reject](#post-ptsproposalsidapprove-e-reject) |

## GET /patients/authorized

Exige sessão autenticada. O admin recebe todos os pacientes cadastrados, com ou
sem PTS (RN022). O profissional recebe os pacientes dos PTS em `planning`,
`running`, `concluded` ou `cancelled` de que é ou foi responsável ou membro da
equipe (RN016); `draft` e `rejected` não dão acesso. Conta sem perfil
profissional, que não é admin, recebe `403` (`FORBIDDEN`).

Parâmetros de query (paginação de `common/pagination`):

- `page`: padrão `1`, mínimo `1`;
- `limit`: padrão `20`, mínimo `1` e máximo `50`;
- `q`: opcional, busca parcial por nome, nome social, e-mail, CNS ou CPF, sem
  diferenciar maiúsculas; com só dígitos e pontuação, compara também os
  dígitos do CPF e do CNS. Trata `%`, `_` e `\` como texto; vazio equivale a
  sem busca;
- `status`: opcional, lista separada por vírgula de `draft`, `planning`,
  `running`, `concluded`, `cancelled`, `rejected` e `none` (sem PTS). O
  profissional só filtra entre `planning`, `running`, `concluded` e
  `cancelled`; os outros valores são ignorados para ele;
- `responsibleProfessionalId`: opcional, perfil profissional responsável por
  um PTS do paciente (menos os rejeitados);
- `registeredFrom` e `registeredTo`: opcionais, `AAAA-MM-DD`, inclusive;
- `sort`: `name` (padrão) ou `registeredAt`; `order`: `asc` (padrão) ou `desc`.

O status do PTS de cada paciente é o do PTS ativo; sem ele, o do mais recente
sem contar os rejeitados; só com rejeitados, `rejected`; sem PTS, `null`.

A resposta contém `{ data: [{ id, name, socialName, email, cns, guardianName,
registeredAt, ptsStatus, activePtsId, readOnly }], pagination: { page, limit,
total, totalPages } }`. `readOnly` é `true` para o profissional quando o
acesso vem só de PTS concluído ou cancelado (RN024); campo ainda vazio vem
como `null`. Os erros possíveis são `400` (`Parâmetro inválido: X`), `401`
(sem sessão), `403` e `500` (`Não foi possível consultar os pacientes
autorizados.`).

## GET /patients/:id

Detalhe do paciente, com o escopo da lista acima: o admin abre qualquer
paciente; o profissional, só os do seu acesso. A resposta tem os campos da
lista e mais `cpf` e `supportContacts` (`[{ name, description?, email?,
phone? }]`). Os erros possíveis são `400` (`Parâmetro inválido: id`, id que
não é UUID), `401`, `403` (`FORBIDDEN`, fora do acesso ou conta sem perfil
profissional), `404` (`PATIENT_NOT_FOUND`) e `500`.

## GET /patients/available-for-pts

Exige sessão autenticada de uma conta com perfil profissional ou de admin e lista os
pacientes que podem receber uma nova proposta: os que não têm PTS em
`planning` ou `running`. Proposta em `draft` não impede uma nova. Não exige
vínculo prévio com o paciente; é a lista que o `pts/novo` usa para escolher o
paciente.

Usa a paginação de `common/pagination` (padrão `20`, máximo `50`) e o `name`
opcional (busca parcial pelo nome). A resposta contém `{ data: [{ id, name }],
pagination }`.
Os erros possíveis são `400` (`Parâmetro inválido: X`), `401` (sem sessão),
`403` (`FORBIDDEN`, conta sem perfil profissional e que não é admin) e `500`
(`Não foi possível consultar os pacientes disponíveis.`).

## GET /pts/active

Exige sessão autenticada e consulta o PTS ativo do paciente informado. O
paciente titular recebe os dados sem `socialSituation`; o profissional
responsável, integrante da equipe ou admin recebe o PTS completo.

Parâmetros de query:

- `patientId`: UUID da conta do paciente.

A resposta contém `{ id, status, socialSituation?, createdAt, acceptedAt,
beganAt, patient, responsible, team }`; `acceptedAt` e `beganAt` podem ser
`null`. Os erros possíveis são `400` (`Parâmetro inválido: patientId`), `401`
(sem sessão), `403` (`FORBIDDEN`) e, para o próprio paciente e para o admin,
`404` (`ACTIVE_PTS_NOT_FOUND`).

## GET /pts/:id

Exige sessão autenticada e devolve o PTS em qualquer estado (RFPTS009), com
`rejectedAt`, `concludedAt` e `cancelledAt` além dos campos de `GET
/pts/active`. O admin abre qualquer PTS; o profissional responsável ou membro
da equipe, menos o PTS rejeitado (RN016); o paciente titular, os próprios PTS,
sem `socialSituation` (RN028). Os erros possíveis são `400` (`Parâmetro
inválido: id`), `401`, `403` (`FORBIDDEN`) e `404` (`PTS_NOT_FOUND`).

Em todas as respostas de PTS (criação, propostas, ativo e por id), o
responsável e cada membro da equipe trazem `registration` (`{ council, number,
state }`, com o conselho vindo da especialidade, ou `null`), como no `GET
/professionals`.

## GET /accounts

Exige sessão autenticada com papel `admin` e lista as contas (tela Contas do
administrador e escolha da conta no cadastro de perfil de paciente ou
profissional). Sem filtros, traz todas as contas, inclusive as de admin e as
desativadas.

Parâmetros de query (todos opcionais):

- `q`: busca parcial por nome, nome social, e-mail ou CPF (com ou sem
  pontuação), sem diferenciar maiúsculas; os espaços externos são removidos,
  `%`, `_` e `\` valem como texto e vazio equivale a sem busca;
- `profile`: `none` (conta sem perfil de paciente nem profissional e que não é
  admin), `patient`, `professional` e `admin`; lista separada por vírgula ou
  repetida; a conta entra se bater com qualquer valor;
- `status`: `active` ou `inactive`; omitido traz as duas;
- `createdFrom` e `createdTo`: data de criação, `AAAA-MM-DD`, inclusivas;
- `sort`: `name` (padrão, nome exibido: o social, se houver) ou `createdAt`;
  `order`: `asc` (padrão) ou `desc`;
- `isPatient` e `isProfessional`: `true` ou `false`; filtros do combobox de
  perfis, que mantêm só contas de usuário (RN002) sem/com o perfil;
- `page` (padrão `1`) e `limit` (padrão `20`, máximo `50`).

Os filtros se combinam e entram antes da paginação, então o `total` já vem
filtrado. A resposta é `{ data: [{ id, name, socialName, email, cpf, role,
profile, specialisms, status, createdAt }], pagination: { page, limit, total,
totalPages } }`: `name` é o nome exibido, `cpf` é `null` no admin, `role` é
`user` ou `admin`, `profile` é `none`, `patient`, `professional` ou `admin`,
`specialisms` traz as do perfil profissional (vazio nos demais) e `status` é
`active` ou `inactive`. Os erros possíveis são `400`
(`{ status: 'ERROR', message: 'Parâmetro inválido: X' }`), `401` (sem sessão),
`403` (`FORBIDDEN`, conta sem papel `admin`) e `500`
(`Não foi possível consultar as contas.`).

## GET /accounts/:id

Só `admin`. Devolve os dados do modal "Dados da conta": `id`, `fullName`,
`socialName`, `birthDate`, `sex`, `gender`, `cpf`, `email`, `phone`, `role`,
`status`, `createdAt`, `updatedAt` (`null` se nunca atualizada) e `profile`
(`{ type: 'none' | 'patient' | 'professional' | 'admin', specialisms: string[] }`).
Os erros possíveis são `400` (`VALIDATION_ERROR`, `id` que não é UUID), `401`,
`403` (`FORBIDDEN`), `404` (`ACCOUNT_NOT_FOUND`) e `500`.

## PATCH /me

Exige sessão autenticada e atualiza os dados da conta atual (RFAUT004). O papel
e o CPF não podem ser alterados.

Corpo:

```json
{
  "name": "Maria Silva",
  "email": "maria@exemplo.com",
  "socialName": null,
  "birthDate": "1990-05-20",
  "sex": "female",
  "gender": "cis_woman",
  "phone": "(11) 98765-4321"
}
```

Todos os campos são opcionais, mas pelo menos um deve ser informado. O nome é
removido de espaços externos e o e-mail é removido de espaços externos e
convertido para minúsculas. `birthDate` é `AAAA-MM-DD` e não pode estar no
futuro; `sex` é `male` ou `female`; `gender` segue o enum `gender_e`. Em
`socialName`, `gender` e `phone`, `null` (ou texto vazio) apaga o campo; o
telefone, com DDD, é gravado só com dígitos. Responde `200` com o mesmo corpo do
`GET /me`, que traz também `socialName`, `birthDate`, `sex`, `gender`, `cpf`,
`phone`, `createdAt` e `updatedAt`.
Os erros possíveis são `400` (`VALIDATION_ERROR`), `401` (sem sessão), `403`
(`FORBIDDEN` quando o corpo tenta alterar `role`), `409`
(`EMAIL_ALREADY_EXISTS`) e `500` (`Não foi possível atualizar o e-mail.`).

## DELETE /me e DELETE /accounts/:id

Desativam a conta (exclusão lógica, RFAUT005 e RN021; também é a desativação de
profissional, RFPRO004). `DELETE /me` é do titular, com qualquer sessão válida;
`DELETE /accounts/:id` é só do `admin` e aceita qualquer conta (o `id` é UUID).
Não há corpo.

Numa transação, a conta recebe `status = 'inactive'`, `deactivated_at` e
`deactivated_by_account_id` (quem pediu), e o perfil profissional sai das
equipes dos PTS em `planning` ou `running`. Registros do profissional mantêm a
autoria; perfis e dados clínicos não são apagados. Depois da transação, todas
as sessões da conta são revogadas no SuperTokens (se a revogação falhar, só vai
para o log: o `AuthGuard` já recusa a conta inativa). A conta inativa também
não faz login: a resposta é a de credenciais erradas, sem revelar o motivo.

Responde `200` com `{ id, status: "inactive", deactivatedAt }`. Os erros
possíveis são `400` (`VALIDATION_ERROR`, `id` que não é UUID), `401`, `403`
(`FORBIDDEN`, só em `/accounts/:id`), `404` (`ACCOUNT_NOT_FOUND`), `409`
(`ACCOUNT_ALREADY_DEACTIVATED` ou `ACCOUNT_IS_PTS_RESPONSIBLE`, quando o perfil
profissional é responsável por PTS ativo, RN007) e `500`.

Efeito nas consultas: a conta inativa sai do `GET /patients/authorized` e do
`GET /professionals` (seleção de equipes) para quem não é admin; o admin a vê
no `GET /accounts` e no `GET /professionals`, com `status` (`active` ou
`inactive`). A migration `AddAccountStatus` cria `account_status_e` e as três
colunas; a FK `FK_patient_account` já é `ON DELETE RESTRICT`.

## POST /me/password

Exige sessão autenticada e troca a senha da conta atual pelo SuperTokens.

Corpo:

```json
{
  "currentPassword": "senha-atual-123",
  "newPassword": "nova-senha-456"
}
```

Responde `200` com `{ "status": "OK" }`. Os erros possíveis são `400`
(`VALIDATION_ERROR` para corpo inválido ou senha nova fora da política, e
`INVALID_CURRENT_PASSWORD` para senha atual incorreta), `401` (sem sessão),
`403` (`FORBIDDEN`) e `500` (`Não foi possível atualizar a senha.`).

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

`supportContacts` é opcional (ausente vira `[]`); cada contato segue as regras
de [Contatos de suporte](#contatos-de-suporte). Os textos são salvos sem
espaços externos, e campos opcionais vazios são descartados.

Responde `201` com `{ accountId, supportContacts }`. Os erros possíveis são
`400` (`VALIDATION_ERROR`, com a mensagem do campo), `401` (sem sessão), `403`
(`FORBIDDEN`), `404` (`ACCOUNT_NOT_FOUND`), `409` e `500`
(`Não foi possível cadastrar o perfil de paciente.`). O `409` sai, nesta ordem
de checagem, com:

- `ADMIN_ACCOUNT_NOT_ALLOWED`: conta de administrador;
- `ACCOUNT_HAS_PROFESSIONAL_PROFILE`: conta que já tem perfil profissional
  (admin, paciente e profissional usam contas separadas, RFPAC001.E04);
- `PATIENT_PROFILE_ALREADY_EXISTS`: conta que já tem perfil de paciente,
  também em pedidos simultâneos.

O `patientProfileId` da sessão vem do access token: a conta que recebeu o
perfil só aparece como paciente depois de um novo login.

## Contatos de suporte

Contato a contato, cada um com `id` próprio (RFPAC003). Não concede tutela nem
acesso (RN017). Campos: `name` (obrigatório), `description`, `email`, `phone`
(com DDD, 10 ou 11 dígitos, com ou sem máscara) e `isEmergency` (padrão
`false`). Informe e-mail ou telefone; o contato de emergência exige telefone.

- `GET`: `200` com `{ data: [{ id, name, description, email, phone, isEmergency }] }`
  para o admin, o profissional com vínculo (inclusive de PTS encerrado, RN016) e
  o próprio paciente.
- `POST`: corpo com os campos acima; `201` com o contato.
- `PATCH`: os campos ausentes ficam como estão e `null` limpa `description`,
  `email` ou `phone`; a regra de e-mail ou telefone vale para o contato
  resultante. `200` com o contato.
- `DELETE`: `204`.

Criar, editar e remover é só do admin e do profissional membro de PTS em
planejamento ou em andamento do paciente (RN024); profissional de PTS encerrado
e o próprio paciente só leem (`403`). Erros: `400 VALIDATION_ERROR`, `401`,
`403 FORBIDDEN`, `404 PATIENT_NOT_FOUND`, `404 SUPPORT_CONTACT_NOT_FOUND` (contato
inexistente ou de outro paciente) e `500`. `GET /patients/:id` passa a devolver
os contatos neste mesmo formato.

## Contatos de suporte

Editados contato a contato, na tabela `support_contact` (RFPAC003). Contato de
suporte não concede tutela nem acesso (RN017).

- `GET /patients/:patientId/support-contacts`: `200 { data: [...] }`, na ordem
  de cadastro. Admin, profissional com vínculo (RN016, inclusive de PTS
  encerrado, só leitura) e o próprio paciente.
- `POST`: `201` com o contato criado. `PATCH .../:contactId`: `200` com o
  contato; o que não vem fica como está e `null` limpa `description`, `email`
  ou `phone`. `DELETE .../:contactId`: `204`. Só o admin e o membro de PTS
  `planning` ou `running` do paciente (RN024); o paciente e o profissional de
  PTS encerrado recebem `403`.

Cada contato é `{ id, name, description, email, phone, isEmergency }`. Regras
(as mesmas do cadastro, RFPAC001): `name` obrigatório; e-mail ou telefone;
telefone com DDD (10 ou 11 dígitos) e obrigatório quando `isEmergency` é
`true` (padrão `false`). No `PATCH`, a regra vale para o contato resultante.

Erros: `400 VALIDATION_ERROR`, `401`, `403 FORBIDDEN`, `404 PATIENT_NOT_FOUND`,
`404 SUPPORT_CONTACT_NOT_FOUND` (inexistente ou de outro paciente) e `500`.

## POST /professionals

Exige sessão autenticada com papel `admin` e cria um perfil profissional para
uma conta de usuário comum (RFPRO002). Uma conta tem no máximo um perfil
profissional (RN002).

Corpo:

```json
{ "accountId": "0b6f5a4e-2c1d-4e8f-9a7b-3c2d1e0f9a8b", "specialism": "psychologist" }
```

`accountId` é um UUID, e `specialism` é `psychologist`, `doctor` ou
`physiotherapist` (`specialism_e`).

Responde `201` com `{ id, accountId, name, email, specialism: { id, name },
deactivatedAt }`; `specialism` tem o mesmo formato do `GET /professionals`, e
`deactivatedAt` é sempre `null` até a desativação (RFPRO004) existir. Os erros
possíveis são `400` (`VALIDATION_ERROR`, com a mensagem do campo), `401` (sem
sessão), `403` (`FORBIDDEN`), `404` (`ACCOUNT_NOT_FOUND`), `409` e `500`
(`Não foi possível cadastrar o perfil profissional.`). O `409` sai, nesta
ordem de checagem, com:

- `ADMIN_ACCOUNT_NOT_ALLOWED`: conta de administrador;
- `ACCOUNT_HAS_PATIENT_PROFILE`: conta que já tem perfil de paciente;
- `PROFESSIONAL_PROFILE_ALREADY_EXISTS`: conta que já tem perfil
  profissional. A restrição única `UQ_professional_account` (`account_id`)
  garante a regra também em pedidos simultâneos.

A regra entre paciente e profissional fica só na aplicação: um `POST
/patients` e um `POST /professionals` simultâneos na mesma conta podem passar
os dois. Os `professionalProfileIds` da sessão vêm do access token: a conta
que recebeu o perfil só aparece como profissional depois de um novo login.

## GET /pts/proposals

Lista as propostas em rascunho (`draft`), da mais recente para a mais antiga,
com a paginação compartilhada (`page`, `limit` padrão 20 e máximo 50). Query
opcional:

- `patientId`: só as propostas desse paciente. Sem ele, o admin vê todas, o
  profissional as de que é responsável ou membro e o paciente as próprias.
- `q`: parte do nome ou do nome social do paciente, sem diferenciar
  maiúsculas.

Para o paciente, a resposta não traz `socialSituation` (RN028). Com
`patientId`, o profissional sem vínculo com o paciente recebe `403`
(`FORBIDDEN`).

## PATCH /pts/proposals/:id

Exige sessão autenticada e permite que somente o profissional responsável ou
o admin editem uma proposta em estado `draft`.

Corpo (ao menos um campo):

```json
{
  "socialSituation": "Mora com a mãe e frequenta a escola municipal.",
  "teamProfessionalIds": ["5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a"]
}
```

`socialSituation` e `teamProfessionalIds` são opcionais; uma lista vazia
remove a equipe. A resposta `200` retorna a proposta atualizada. Os erros
possíveis são `400` (`VALIDATION_ERROR` ou
`TEAM_PROFESSIONAL_NOT_FOUND`), `401` (sem sessão), `403`
(`FORBIDDEN`), `404` (`PTS_NOT_FOUND`) e `409`
(`PTS_NOT_DRAFT`).

## DELETE /pts/proposals/:id

Exige sessão autenticada; só o profissional responsável ou o admin (RN022)
excluem uma proposta em `draft`. Não há corpo.

A exclusão é lógica (RN021): a proposta ganha `deleted_at` com a data atual,
sem apagar a linha nem a equipe. A partir daí ela some de
`GET /pts/proposals`, `GET /pts/proposals/:id` (`404`) e das demais rotas
de proposta, e não pode mais ser aprovada. PTS aprovado não é excluído: ele
é cancelado no encerramento (RFPTS010).

A resposta `200` é:

```json
{ "status": "OK" }
```

Os erros possíveis são `400` (`VALIDATION_ERROR`, `id` que não é UUID),
`401` (sem sessão), `403` (`FORBIDDEN`), `404` (`PTS_NOT_FOUND`, inclusive
para proposta já excluída) e `409` (`PTS_NOT_DRAFT`). A transação trava a
proposta (`pessimistic_write`) e refaz as checagens, então uma aprovação
simultânea não deixa excluir um PTS que acabou de ser aprovado.

## DELETE /pts/:id/team/:professionalId

Exige sessão autenticada; só o profissional responsável ou o admin (RN006 e
RN022) removem um membro da equipe de um PTS em `planning` ou `running`. Não
há corpo. O responsável não sai por esta rota (RN007): a saída dele é a
transferência de responsabilidade (RFEM002).

Na mesma transação, o vínculo em
`professional_participating_on_therapeutic_journey` é apagado e um
`timeline_record` é gravado: `type: member_removed`, `target_type: team_member`,
`target_id` = id do profissional removido, `pts_id`, `author_professional_id`
= responsável (nulo quando o admin remove) e `executed_by_account_id` = conta
que executou (RN029). Registros anteriores do removido mantêm a autoria.

A resposta `200` retorna o PTS com o responsável e a equipe atualizada:

```json
{
  "id": "3f2e1d0c-9b8a-4765-a432-10fedcba9876",
  "status": "running",
  "responsible": {
    "id": "7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f",
    "name": "Kaio Segunda Conta",
    "specialism": { "id": "psychologist", "name": "Psicologia" },
    "registration": null
  },
  "team": []
}
```

Os erros possíveis são `400` (parâmetro que não é UUID), `401` (sem
sessão), `403` (`FORBIDDEN`), `404` (`PTS_NOT_FOUND` ou
`TEAM_MEMBER_NOT_FOUND`) e `409` (`PTS_NOT_ACTIVE` ou
`CANNOT_REMOVE_RESPONSIBLE`). A transação trava o PTS
(`pessimistic_write`) e refaz as checagens, então uma transferência de
responsabilidade ou um encerramento simultâneo não passam despercebidos.

## POST /pts/proposals/:id/approve e /reject

Exige sessão autenticada; só o paciente dono ou o admin (em nome do paciente,
RN022) decidem uma proposta em `draft`. Não há corpo.

- **approve**: a proposta vai para `planning` com `acceptedAt`, e as demais
  `draft` do paciente vão para `rejected` com `rejectedAt`, na mesma
  transação.
- **reject**: só a proposta escolhida vai para `rejected` com `rejectedAt`.

A resposta `200` retorna a proposta decidida:

```json
{
  "id": "3f2e1d0c-9b8a-4765-a432-10fedcba9876",
  "status": "planning",
  "acceptedAt": "2026-10-15T12:30:00.000Z",
  "rejectedAt": null
}
```

Os erros possíveis são `400` (`id` que não é UUID), `401` (sem sessão),
`403` (`FORBIDDEN`), `404` (`PTS_NOT_FOUND`) e `409` (`PTS_NOT_DRAFT` ou,
na aprovação, `ACTIVE_PTS_ALREADY_EXISTS`).

A transação trava os PTS do paciente (`pessimistic_write`, em ordem de
`id`) e refaz as checagens, então duas decisões simultâneas não deixam dois
PTS ativos nem rejeitam um PTS já aprovado.

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
