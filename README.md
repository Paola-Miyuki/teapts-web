# teapts-web

| Serviço       | Tecnologia                      | Porta |
| ------------- | ------------------------------- | ----- |
| `backend`     | NestJS + TypeORM                | 3000  |
| `frontend`    | Next.js                         | 3001  |
| `postgres`    | PostgreSQL 16                   | 5432  |
| `supertokens` | SuperTokens Core (autenticação) | 3567  |

Dois modos de trabalho, que usam o mesmo `.env` e o mesmo banco (dá para alternar):

- **Local** ([seção 3](#3-rodar-local)): backend e frontend na máquina com `pnpm`; Postgres e SuperTokens no Docker.
- **Docker** ([seção 4](#4-rodar-no-docker)): tudo em containers, via `make`.

Testes, lint e `typecheck` rodam sempre **na máquina**, então Node e pnpm são pré-requisito nos dois modos.

**Primeira vez?** [Pré-requisitos](#1-pré-requisitos) → [Setup](#2-setup) → suba a stack (local ou Docker) → `make seed` para as contas de teste → teste a API pelo [Swagger](#6-api-e-swagger).

---

## 1. Pré-requisitos

| Ferramenta        | Versão          |
| ----------------- | --------------- |
| Git               | recente         |
| Node.js           | **22.12+** (24) |
| pnpm              | **12.9.1+**     |
| Docker Compose v2 | recente         |
| Make              | qualquer        |

```bash
node -v && pnpm -v && docker compose version && make -v
nvm install 24 && nvm use 24                       # se faltar Node
corepack enable && corepack prepare pnpm@latest --activate   # se faltar pnpm
```

---

## 2. Setup

```bash
git clone <URL-DO-REPOSITORIO> teapts-web && cd teapts-web
make env       # cria backend/.env e frontend/.env a partir dos .env.example
make install   # instala as dependências e registra os hooks do Husky
```

Abra `backend/.env` e **preencha `DATABASE_PASSWORD`**; vale fixar também `SUPERTOKENS_VERSION` (o padrão `latest` não é reproduzível). Os `.env` nunca são sobrescritos nem versionados: ao criar variável nova, atualize o `.env.example`.

---

## 3. Rodar local

```bash
make up-d-db                      # postgres + supertokens; `make ps` deve mostrar "healthy"
pnpm --dir backend migration:run  # aplica as migrations
pnpm --dir backend start:dev      # http://localhost:3000   (terminal 1)
pnpm --dir frontend dev -p 3001   # http://localhost:3001   (terminal 2; login em /login)
pnpm --dir backend run seed:test-user   # contas e PTS de teste (no local, sem o container)
```

No `backend/.env`, use `DATABASE_HOST=localhost` e `SUPERTOKENS_CONNECTION_URI=http://localhost:3567` (os nomes `postgres` e `supertokens` só existem na rede do Docker). Mudou o `frontend/.env`? Reinicie o `pnpm dev`: as `NEXT_PUBLIC_*` entram no bundle no build.

Pacote novo: rode `pnpm --dir backend add <pkg>` (ou `frontend`) e commite `package.json` + `pnpm-lock.yaml` juntos.

---

## 4. Rodar no Docker

```bash
make up-d      # builda, sobe postgres → supertokens → backend → frontend e aplica as migrations
make ps        # todos "running"/"healthy"
make seed      # contas e PTS de teste
```

Frontend em <http://localhost:3001>, backend em <http://localhost:3000>. Se a migration falhar, os containers continuam no ar: veja `make logs-backend` e rode `make migrate`. `make up` segue os logs (`Ctrl+C` só fecha os logs; use `make down` para parar).

- **Sem mount de código nem hot reload:** o container serve o que estava na imagem no build. Mudou algo em `backend/` ou `frontend/` (código, `package.json`, lockfile, `Dockerfile`)? Rebuilde: `make rebuild-backend` ou `make rebuild-frontend`. Para iterar em código, use o modo local.
- **Mudou `frontend/.env`?** `make rebuild-frontend-no-cache`: as `NEXT_PUBLIC_*` são embutidas no build e o cache serviria o valor antigo.
- **Banco no volume `postgres_data`:** sobrevive ao `make down`; só o `make clean` apaga (inclusive usuários e sessões do SuperTokens).
- **Ordem de subida por healthcheck** (SuperTokens espera o Postgres; o backend espera os dois; o frontend espera o `GET /health`); o build do frontend precisa de rede (fontes do Google).

---

## 5. Banco de dados

O schema só muda por migration. Migrations, regras do modelo, contas de teste, consultas e reset do banco estão no [`backend/README.md`](backend/README.md#banco-de-dados). Atalhos:

```bash
make migrate-show    # lista as migrations ([X] = aplicada)
make migrate         # aplica as pendentes
make seed            # contas e PTS de teste, no Docker (local: pnpm --dir backend run seed:test-user)
make clean           # APAGA o banco (pede confirmação); depois: make up-d && make seed
```

---

## 6. API e Swagger

Com o backend no ar, a documentação interativa fica em **<http://localhost:3000/docs>** (OpenAPI em JSON: `/docs-json`). Ela lista todas as rotas, com corpo, parâmetros e respostas; as rotas e quem acessa cada uma estão no [`backend/README.md`](backend/README.md#rotas).

**Chamar uma rota protegida pelo Swagger:**

1. Rode `POST /auth/signin` com o header `rid: emailpassword` e o corpo `{"formFields":[{"id":"email","value":"teste@teapts.local"},{"id":"password","value":"teapts123"}]}`.
2. Com `st-auth-mode: cookie`, o navegador guarda os cookies e as próximas chamadas já vão autenticadas. Com `st-auth-mode: header`, copie o `st-access-token` da resposta para o botão **Authorize** (esquema `bearer`).
3. Chame `GET /me`: deve devolver a conta.

**Pelo curl** (modo header):

```bash
API=http://localhost:3000
ACCESS=$(curl -s -D - -o /dev/null -X POST "$API/auth/signin" \
  -H 'rid: emailpassword' -H 'st-auth-mode: header' -H 'Content-Type: application/json' \
  -d '{"formFields":[{"id":"email","value":"teste@teapts.local"},{"id":"password","value":"teapts123"}]}' \
  | grep -i '^st-access-token:' | cut -d' ' -f2 | tr -d '\r')
curl -s "$API/me" -H "Authorization: Bearer $ACCESS"
```

---

## 8. Comandos make

`make help` lista todos. Os alvos de banco e de logs usam o Docker; os de teste e qualidade rodam na máquina.

| Grupo                  | Comandos                                                                                                                                                                                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Setup**              | `env` (cria os `.env`, sem sobrescrever) · `install` (pnpm + hooks do Husky)                                                                                                                                                                                               |
| **Subir e parar**      | `up` (segue os logs) · `up-d` (segundo plano) · `up-d-db` (só Postgres e SuperTokens) · `stop` / `start` (backend e frontend, mantendo o banco) · `restart`, `restart-backend`, `restart-frontend` · `down` (o banco fica) · `clean` (**apaga o banco**) · `ps` · `health` |
| **Rebuild**            | `rebuild` · `rebuild-no-cache` · `rebuild-backend` · `rebuild-frontend` · `rebuild-frontend-no-cache` (depois de mudar `frontend/.env`)                                                                                                                                    |
| **Logs e acesso**      | `logs`, `logs-backend`, `logs-frontend`, `logs-db` · `shell-backend`, `shell-frontend` · `psql`                                                                                                                                                                            |
| **Migrations e seed**  | `migrate` · `migrate-show` · `migrate-revert` · `migrate-generate NAME=AddFoo` (no host, precisa do banco no ar) · `seed`                                                                                                                                                  |
| **Consultas ao banco** | `db-tables` · `db-account` · `db-patients` · `db-support-contacts` · `db-professionals` · `db-pts` · `db-query SQL="select * from account"`                                                                                                                                |
| **Testes e qualidade** | `test` · `test-e2e` · `typecheck` · `lint` · `format` (altera arquivos) · `format-check` · `check`                                                                                                                                                                         |

Todo alvo que sobe o backend (`up`, `up-d`, `rebuild*`) já aplica as migrations.
