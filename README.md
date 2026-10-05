# teapts-web

| Serviço       | Tecnologia                      | Porta |
| ------------- | ------------------------------- | ----- |
| `backend`     | NestJS + TypeORM                | 3000  |
| `frontend`    | Next.js                         | 3001  |
| `postgres`    | PostgreSQL 16                   | 5432  |
| `supertokens` | SuperTokens Core (autenticação) | 3567  |

Dois modos de trabalho:

- **Local** ([seção 3](#3-rodar-local)): backend e frontend na máquina com `pnpm`; Postgres e SuperTokens no Docker.
- **Docker** ([seção 4](#4-rodar-no-docker)): tudo em containers, via `make`.

Escolha livre, e dá para alternar: os dois usam o mesmo `.env` e o mesmo banco. Em qualquer um dos dois, testes, lint e `typecheck` rodam **na máquina** — por isso Node e pnpm são pré-requisito mesmo para quem só quer Docker.

**Primeira vez no projeto?** Siga nesta ordem:

1. [Pré-requisitos](#1-pré-requisitos) e [Setup](#2-setup) (`make env`, `make install`, preencher `DATABASE_PASSWORD`).
2. Suba a stack: [local](#3-rodar-local) **ou** [Docker](#4-rodar-no-docker).
3. Crie a conta de teste: [5.2](#52-conta-de-teste).
4. Teste o login com os curls de [6.4](#64-testar-com-curl).

Este README cobre a stack inteira. Scripts, variáveis e estrutura de cada projeto ficam em [`backend/README.md`](backend/README.md) e [`frontend/README.md`](frontend/README.md).

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
```

Falta Node ou pnpm:

```bash
nvm install 24 && nvm use 24     # https://github.com/nvm-sh/nvm
corepack enable && corepack prepare pnpm@latest --activate
```

---

## 2. Setup

```bash
git clone <URL-DO-REPOSITORIO> teapts-web
cd teapts-web
make env       # cria backend/.env e frontend/.env a partir dos .env.example
make install   # instala as bibliotecas e registra os hooks do Husky
```

Depois do `make env`, abra `backend/.env` e **preencha `DATABASE_PASSWORD`**. Vale também fixar `SUPERTOKENS_VERSION`: o padrão é `latest`, que não é reproduzível. As demais variáveis (inclusive as do SuperTokens, ver [6.2](#62-variáveis-de-ambiente)) já vêm com valores que funcionam em desenvolvimento. Os `.env` nunca são sobrescritos nem versionados — ao criar variável nova, atualize o `.env.example`.

---

## 3. Rodar local

**3.1 Suba só o banco e o SuperTokens:**

```bash
make up-d-db     # postgres + supertokens em segundo plano
make ps          # os dois devem estar "healthy"
```

**3.2 Confira o `backend/.env`:** use `DATABASE_HOST=localhost` e `SUPERTOKENS_CONNECTION_URI=http://localhost:3567`. Os nomes `postgres` e `supertokens` só resolvem dentro da rede do Docker, e é o Compose que os injeta nos containers.

Para conferir se o SuperTokens Core está no ar:

```bash
curl -s http://localhost:3567/hello     # responde "Hello"
```

**3.3 Aplique as migrations** (ver [seção 5](#5-banco-de-dados)):

```bash
cd backend && pnpm migration:run
```

**3.4 Suba os dois serviços**, em terminais separados:

```bash
cd backend  && pnpm start:dev     # http://localhost:3000
cd frontend && pnpm dev -p 3001   # http://localhost:3001
```

**3.5 Crie a conta de teste** ([5.2](#52-conta-de-teste)) e teste o login ([6.4](#64-testar-com-curl)). A tela de login fica em <http://localhost:3001/login>.

**Mudou `frontend/.env`?** Pare o `pnpm dev` e suba de novo: as `NEXT_PUBLIC_*` entram no bundle no build, e o servidor em execução não relê o arquivo. No Docker, o equivalente é `make rebuild-frontend-no-cache`.

**Adicionar pacote:** rode na pasta que vai recebê-lo e commite `package.json` + `pnpm-lock.yaml` juntos.

```bash
cd backend && pnpm add axios         # ou pnpm add -D @types/foo
```

---

## 4. Rodar no Docker

```bash
make up-d      # builda (na 1ª vez), sobe postgres → supertokens → backend → frontend
               # e aplica as migrations pendentes
make ps        # todos "running"/"healthy"
```

Frontend em <http://localhost:3001> (login em `/login`), backend em <http://localhost:3000>. Em seguida, crie a conta de teste com `make seed` ([5.2](#52-conta-de-teste)) e teste o login ([6.4](#64-testar-com-curl)).

Todo alvo que sobe o backend (`up`, `up-d`, `rebuild`, `rebuild-no-cache`, `rebuild-backend`) espera o container ficar em execução e então roda `make migrate`. Se a migration falhar, o comando termina com erro **e os containers continuam no ar** — investigue com `make logs-backend` e rode `make migrate` de novo. `make up` sobe em segundo plano e segue os logs, então `Ctrl+C` só fecha os logs: para parar de verdade, use `make down`.

O que o `docker-compose.yml` garante:

- **Imagens multi-stage, sem mount de código:** o `pnpm install` e o build rodam num estágio descartado. A imagem final do backend tem só `dist/` e as 9 dependências de produção; a do frontend, só a saída `standalone` do Next. **Nem pnpm, nem TypeScript, nem ts-node, nem Jest.** O único volume é o `postgres_data`.
- **Sem hot reload:** o container serve o código que estava na imagem no momento do build.
- **O build do frontend precisa de rede:** `next/font/google` baixa as fontes durante o `next build`.
- **Banco no volume `postgres_data`:** sobrevive ao `make down`; só o `make clean` apaga.
- **Rede `teapts-network`:** os serviços se acham pelo nome (`postgres`, `supertokens`, `backend`).
- **Ordem de subida por healthcheck:** SuperTokens espera o Postgres saudável, o backend espera os dois, e o frontend espera o `GET /health` do backend passar. Nada sobe em cima de um serviço que ainda não responde.
- **Versão do SuperTokens vem do `.env`:** `SUPERTOKENS_VERSION` (padrão `latest`). Fixe uma versão — o core roda migrations no Postgres ao subir.
- **SuperTokens no schema `supertokens`:** o core usa o mesmo banco da aplicação, mas cria as tabelas dele no schema `supertokens` (`POSTGRESQL_TABLE_SCHEMA`). As tabelas da aplicação ficam no `public`.
- **`frontend/.env` entra como build secret:** fica disponível só durante o `pnpm run build` e não é copiado para a imagem. Sem esse arquivo, o build do frontend falha.

> ⚠️ **Não há mount de código.** Editar arquivo no host não muda nada no container, e o que você fizer dentro do container (`pnpm add`, `pnpm format`, migration gerada) **se perde no próximo rebuild** e nunca chega ao host. Para iterar em código, use o modo local da [seção 3](#3-rodar-local). O Docker aqui serve para rodar a stack inteira como ela vai rodar em produção.

**Mudou código ou dependência? Rebuilde:**

```bash
pnpm --dir backend add axios     # no host, commite package.json + pnpm-lock.yaml
make rebuild-backend             # entra na imagem e aplica as migrations
```

**Rebuildar sempre que:** mudou qualquer coisa em `backend/` ou `frontend/` — código, `package.json`, `pnpm-lock.yaml` ou `Dockerfile`.

> ⚠️ **Mudou `frontend/.env`? Rebuilde o frontend sem cache.**
>
> ```bash
> make rebuild-frontend-no-cache
> ```
>
> As variáveis `NEXT_PUBLIC_*` são embutidas no bundle **no momento do build**, não lidas em tempo de execução. `make restart-frontend` e `make rebuild-frontend` reaproveitam a camada de build em cache e continuam servindo o valor antigo. Só o `--no-cache` força o Next a reconstruir com o valor novo.

---

## 5. Banco de dados

O schema **só muda por migration** (`synchronize` é sempre `false`). Entidades e migrations são registradas **à mão** em `backend/src/database/database.config.ts` — glob com `__dirname` não funciona sob ESM nem depois do build. Criou entidade ou migration nova? Adicione nos arrays `entities`/`migrations` desse arquivo, senão o TypeORM a ignora.

Estrutura em `backend/src/database/`: `entities/`, `enums/`, `migrations/`, `seeds/`.

| Schema | Tabelas | Quem cuida |
| --- | --- | --- |
| `public` | `account`, `patient`, `professional`, `migrations` | migrations do TypeORM |
| `supertokens` | `emailpassword_users`, `session_info`, `all_auth_recipe_users`… | o próprio SuperTokens Core, ao subir |

Não crie migration para as tabelas do schema `supertokens` nem as altere à mão.

### 5.1 Migrations

Toda mudança de schema passa por três passos. Nenhum é opcional:

1. **Registrar** a entidade e a migration nos arrays de `database.config.ts`.
2. **Gerar** a migration — precisa do banco no ar, porque compara as entidades com o schema vivo.
3. **Aplicar** a migration. No Docker, via `make rebuild-backend`.

Editar a entidade não altera o banco. Sem o passo 3, a coluna não existe e a primeira query que a usa quebra.

| Ação | Docker | Local (em `backend/`) |
| --- | --- | --- |
| Ver o que está aplicado | `make migrate-show` | `pnpm migration:show` |
| Aplicar as pendentes | `make migrate` | `pnpm migration:run` |
| Desfazer a última | `make migrate-revert` | `pnpm migration:revert` |
| Gerar a partir das entidades | `make migrate-generate NAME=AddFoo` | `pnpm migration:generate src/database/migrations/AddFoo` |

`migrate-show` marca com `[X]` as aplicadas e com `[ ]` as pendentes. A migration inicial pressupõe banco vazio. Nunca edite migration já aplicada: crie outra.

Aplicar de novo é seguro: o TypeORM grava cada migration aplicada na tabela `migrations` e só roda as pendentes. Por isso `make up`, `make up-d` e os `make rebuild*` já migram sozinhos, e você raramente digita `make migrate`.

> ⚠️ **No Docker, os alvos de migration leem o código compilado** (`dist/database/data-source.js`), porque a imagem final não tem ts-node. Migration que você acabou de escrever só existe no host: rode `make rebuild-backend`, que recompila **e** aplica. `make migrate` sozinho não vê o arquivo novo.

### 5.2 Conta de teste

```bash
make seed                                  # Docker
pnpm --dir backend run seed:test-user      # local
```

Cria o usuário `teste@teapts.local` / `teapts123` **no SuperTokens** e a conta vinculada na tabela `account`, com role `admin`. Precisa do Postgres **e** do SuperTokens no ar. É idempotente: rodar de novo não duplica (se o usuário já existe no SuperTokens, o seed só cria a conta que faltar).

### 5.3 Testar se o banco está de pé

```bash
make db-tables                              # tabelas do public: account, patient, professional, migrations
make db-account                             # mostra as contas
make db-query SQL="\dt supertokens.*"       # tabelas do SuperTokens
make psql                                   # sessão psql interativa
```

`make db-query` aceita qualquer SQL; use `\d`, `\dt`, `\du` como no psql. Sem Docker, conecte direto:

```bash
psql -h localhost -p 5432 -U <DATABASE_USER> -d <DATABASE_NAME> -c '\dt'
```

Os valores estão em `backend/.env` (`DATABASE_USER`, `DATABASE_NAME`, `DATABASE_PASSWORD`).

**Pelo backend**, o endpoint de saúde faz um `SELECT 1`:

```bash
make health
# ou: curl -s http://localhost:3000/health
```

| Resposta | Significado |
| --- | --- |
| `200 {"status":"ok","database":"up"}` | backend e banco respondendo |
| `503 {"status":"degraded","database":"down"}` | backend no ar, banco inacessível |
| Conexão recusada | backend fora do ar |

### 5.4 Zerar o banco

```bash
make clean     # APAGA o volume postgres_data (pede confirmação)
make up-d      # já aplica as migrations
make seed
```

Como o SuperTokens usa o mesmo volume, o `make clean` também apaga os usuários e as sessões dele. Depois do reset, só existe a conta criada pelo `make seed`.

Trocar `DATABASE_PASSWORD` **não** muda a senha de um banco já criado no volume: altere no PostgreSQL ou recrie o volume (com backup antes).

---

## 6. Autenticação (SuperTokens)

### 6.1 Como funciona

A autenticação usa o [SuperTokens](https://supertokens.com/docs) com a receita **EmailPassword** e sessões do próprio SuperTokens. São três peças:

| Peça | Onde | O que guarda/faz |
| --- | --- | --- |
| SuperTokens Core | container `supertokens`, porta 3567 | e-mail, senha (hash) e sessões, no schema `supertokens` do Postgres |
| Backend (`supertokens-node`) | `backend/src/auth/` | expõe as rotas `/auth/*` do SDK e a rota protegida `GET /me` |
| Tabela `account` | schema `public` | dados de negócio: `name`, `email`, `role` e o vínculo `supertokens_user_id` |

A aplicação **não guarda senha**. A conta liga-se ao SuperTokens pela coluna `account.supertokens_user_id`, que recebe o id primário do usuário (`user.id`). Os perfis da conta ficam em `patient` (no máximo um) e `professional` (vários).

```text
POST /auth/signup (email, password, name)
  -> SuperTokens cria a identidade
  -> backend cria a linha em account (role = user)
     (se o banco falhar, a identidade é apagada do SuperTokens)
  -> sessão criada

POST /auth/signin (email, password)
  -> SuperTokens valida a senha
  -> backend busca a conta por supertokens_user_id
     (sem conta: 500 e nenhuma sessão)
  -> sessão criada com accountId, role, patientProfileId e professionalProfileIds no token

GET /me
  -> verifySession valida o token
  -> backend devolve os dados da conta
```

Decisões que valem saber antes de mexer:

- **Não existe endpoint de login próprio.** Signin, signup, refresh e signout são as rotas do SDK; o backend só sobrescreve partes delas em `backend/src/auth/supertokens.service.ts`.
- **O contexto da conta só entra no token no signin e no signup.** Esses dois fluxos marcam o `userContext` (`teapts.accountContext`) e o `createNewSession` só adiciona `accountId`, `role` e perfis quando vê essa marca. O refresh mantém o payload que já existia.
- **Os perfis no token são uma foto do momento do login.** Quem criar ou remover um perfil precisa atualizar a sessão (`Session.mergeIntoAccessTokenPayload`) ou exigir login de novo.
- **Erros de conta respondem `500` genérico**, sem stack trace nem detalhe de infraestrutura, e nenhuma sessão é emitida.

Os arquivos de cada peça estão na seção "Estrutura" do [`backend/README.md`](backend/README.md#estrutura).

### 6.2 Variáveis de ambiente

Os valores do `.env.example` já funcionam em desenvolvimento. As que importam para a autenticação:

- `backend/.env`: `SUPERTOKENS_CONNECTION_URI` (endereço do Core; `http://localhost:3567` no modo local), `API_DOMAIN` e `WEBSITE_DOMAIN` (o frontend precisa estar exatamente nessa origem para CORS e cookies funcionarem);
- `frontend/.env`: `NEXT_PUBLIC_API_URL`, o endereço da API usado pelo SDK web.

Tabelas completas em [`backend/README.md`](backend/README.md#variáveis-de-ambiente) e [`frontend/README.md`](frontend/README.md#variáveis-de-ambiente).

### 6.3 Rotas

| Método | Rota | Corpo / headers | Resposta |
| --- | --- | --- | --- |
| POST | `/auth/signup` | `rid: emailpassword`; `formFields`: `email`, `password`, `name` | `200 {"status":"OK","user":{...}}` e sessão |
| POST | `/auth/signin` | `rid: emailpassword`; `formFields`: `email`, `password` | `200 {"status":"OK","user":{...}}` e sessão |
| POST | `/auth/session/refresh` | refresh token | novos tokens |
| POST | `/auth/signout` | access token | `200 {"status":"OK"}` |
| GET | `/me` | access token | dados da conta |

O header `st-auth-mode` escolhe como a sessão trafega:

- `st-auth-mode: cookie` — tokens em cookies `HttpOnly` (é o que o navegador/frontend usa);
- `st-auth-mode: header` — tokens nos headers de resposta `st-access-token` e `st-refresh-token`, enviados de volta em `Authorization: Bearer <token>` (prático para curl e Postman).

A senha precisa de pelo menos 8 caracteres, com letra e número (regra padrão do SuperTokens). O `name` não pode ser vazio.

### 6.4 Testar com curl

Com a stack no ar e a conta de teste criada ([5.2](#52-conta-de-teste)):

```bash
API=http://localhost:3000
H=/tmp/teapts-headers.txt

# 1) Login (modo header): os tokens voltam nos headers da resposta
curl -s -D "$H" -X POST "$API/auth/signin" \
  -H 'rid: emailpassword' -H 'st-auth-mode: header' -H 'Content-Type: application/json' \
  -d '{"formFields":[{"id":"email","value":"teste@teapts.local"},{"id":"password","value":"teapts123"}]}'
echo
ACCESS=$(grep -i '^st-access-token:' "$H" | cut -d' ' -f2 | tr -d '\r')
REFRESH=$(grep -i '^st-refresh-token:' "$H" | cut -d' ' -f2 | tr -d '\r')
echo "access token recebido: ${ACCESS:+sim}"

# 2) Rota protegida
curl -s "$API/me" -H "Authorization: Bearer $ACCESS"
echo

# 3) Renovar a sessão (gera um access token novo)
curl -s -D "$H" -o /dev/null -X POST "$API/auth/session/refresh" \
  -H 'st-auth-mode: header' -H "Authorization: Bearer $REFRESH"
ACCESS=$(grep -i '^st-access-token:' "$H" | cut -d' ' -f2 | tr -d '\r')
REFRESH=$(grep -i '^st-refresh-token:' "$H" | cut -d' ' -f2 | tr -d '\r')

# 4) Logout: revoga a sessão; depois disso o refresh responde 401
curl -s -X POST "$API/auth/signout" -H "Authorization: Bearer $ACCESS"
echo
```

O `GET /me` deve responder:

```json
{
  "accountId": "<uuid da conta>",
  "name": "Usuario de Teste",
  "email": "teste@teapts.local",
  "role": "admin",
  "patientProfileId": null,
  "professionalProfileIds": []
}
```

**Cadastrar uma conta nova** (cria o usuário no SuperTokens e a linha em `account`):

```bash
curl -s -X POST "$API/auth/signup" \
  -H 'rid: emailpassword' -H 'st-auth-mode: header' -H 'Content-Type: application/json' \
  -d '{"formFields":[{"id":"email","value":"maria@teapts.local"},{"id":"password","value":"Senha123"},{"id":"name","value":"Maria"}]}'
```

**Mesmo fluxo com cookies** (como o navegador faz):

```bash
C=/tmp/teapts-cookies.txt
curl -s -c "$C" -X POST "$API/auth/signin" \
  -H 'rid: emailpassword' -H 'st-auth-mode: cookie' -H 'Content-Type: application/json' \
  -d '{"formFields":[{"id":"email","value":"teste@teapts.local"},{"id":"password","value":"teapts123"}]}'
echo
curl -s -b "$C" "$API/me"
echo
```

Respostas que indicam problema:

| Resposta | Causa |
| --- | --- |
| signin `200 {"status":"WRONG_CREDENTIALS_ERROR"}` | e-mail ou senha errados, ou o usuário não existe (rode `make seed` ou cadastre) |
| signin/signup `500` | conta órfã (usuário no SuperTokens sem linha em `account`) ou Core inacessível — veja `make logs-backend` |
| signup `200 {"status":"FIELD_ERROR",...}` | `name` vazio ou senha fraca; a mensagem diz qual campo |
| signup `200 {"status":"EMAIL_ALREADY_EXISTS_ERROR"}` | e-mail já cadastrado |
| `/me` `401 {"message":"unauthorised"}` | nenhum token chegou: o login não deu `OK` ou faltou `Authorization`/cookie |
| `/me` `401 {"message":"try refresh token"}` | access token expirado: chame `/auth/session/refresh` |
| `/me` `401` "Payload de sessão inválido" | sessão criada por uma versão antiga do backend: faça login de novo |

### 6.5 Inspecionar o SuperTokens

```bash
curl -s http://localhost:3567/hello                                               # Core no ar
make db-query SQL="SELECT user_id, email FROM supertokens.emailpassword_users"    # usuários
make db-query SQL="SELECT id, email, supertokens_user_id, role FROM account"      # contas vinculadas
```

Todo `user_id` do SuperTokens deve ter uma conta com o mesmo valor em `supertokens_user_id`. Um usuário sem conta não consegue fazer login (500).

### 6.6 Integração no frontend

O SDK web já está configurado no frontend. Como fazer login, enviar os cookies nas chamadas à API e tratar o `401` está na seção "Autenticação" do [`frontend/README.md`](frontend/README.md#autenticação).

---

## 7. Testes e qualidade

Tudo roda **no host**, contra o código do working tree. Não precisa de container.

```bash
make test        # unitários dos dois projetos
make test-e2e    # e2e do backend: sobe o AppModule e bate nas rotas por HTTP
make typecheck
make lint
make check       # format + lint + typecheck + test: rode antes do commit
```

Ou direto num projeto só:

```bash
pnpm --dir backend test
pnpm --dir frontend lint
```

A lista de scripts de cada projeto está no README dele ([backend](backend/README.md#scripts), [frontend](frontend/README.md#scripts)).

Os testes unitários e e2e **não precisam de banco**: a conexão é substituída por um stub.

---

## 8. Comandos make

**Setup**

| Comando | O que faz |
| --- | --- |
| `make help` | Lista todos os alvos |
| `make env` | Cria os `.env` a partir dos `.env.example` (não sobrescreve) |
| `make install` | `pnpm install` no backend e no frontend, na máquina, + hooks do Husky |

**Ambiente**

| Comando | O que faz |
| --- | --- |
| `make up` | Sobe tudo, aplica as migrations e segue os logs (`Ctrl+C` só sai dos logs) |
| `make up-d` | Sobe tudo em segundo plano e aplica as migrations |
| `make up-d-db` | Sobe só Postgres e SuperTokens (para o modo local) |
| `make rebuild` | Rebuilda as imagens, sobe tudo e aplica as migrations |
| `make rebuild-no-cache` | Rebuilda sem cache, sobe tudo e aplica as migrations |
| `make rebuild-backend` | Rebuilda só o backend e aplica as migrations |
| `make rebuild-frontend` | Rebuilda só o frontend |
| `make rebuild-frontend-no-cache` | Rebuilda o frontend sem cache — **use depois de mudar `frontend/.env`** |
| `make restart` | Reinicia os serviços sem rebuildar |
| `make restart-backend` / `restart-frontend` | Reinicia um serviço |
| `make down` | Para e remove os containers (o banco fica) |
| `make clean` | **Apaga o banco** e os volumes (pede confirmação) |
| `make ps` | Status dos serviços |
| `make health` | `GET /health` do backend |

**Logs e acesso**

| Comando | O que faz |
| --- | --- |
| `make logs` | Logs de todos os serviços |
| `make logs-backend` / `logs-frontend` / `logs-db` | Logs de um serviço |
| `make shell-backend` / `shell-frontend` | Shell dentro do container (imagem de produção: tem `node`, não tem `pnpm`) |
| `make psql` | Sessão psql no banco |

**Banco de dados**

| Comando | O que faz |
| --- | --- |
| `make migrate` | Aplica as migrations pendentes |
| `make migrate-show` | Lista as migrations, `[X]` = aplicada |
| `make migrate-revert` | Desfaz a última |
| `make migrate-generate NAME=AddFoo` | Gera migration a partir das entidades, **no host** (precisa de `make up-d-db`) |
| `make seed` | Cria a conta de teste no SuperTokens e em `account` |
| `make db-tables` | Lista as tabelas |
| `make db-account` | Mostra as contas |
| `make db-query SQL="..."` | Roda um SQL qualquer |

**Testes e qualidade** (rodam no host, sem container)

| Comando | O que faz |
| --- | --- |
| `make test` | Testes unitários dos dois projetos |
| `make test-e2e` | Testes e2e do backend |
| `make typecheck` | Tipos nos dois |
| `make lint` | Lint nos dois |
| `make format` | Prettier nos dois (altera arquivos) |
| `make format-check` | Prettier sem alterar arquivos |
| `make check` | format + lint + typecheck + test, no host |

Os alvos de banco rodam no container `teapts-backend` via `docker exec`. Os de teste e qualidade rodam na máquina, contra o working tree — por isso valem para os dois modos.

---

## 9. Commits

```bash
git checkout -b feat/nome-da-feature
make check            # formata e valida no host — rode ANTES do git add
git add . && git status
git commit -m "feat: add user login route"
git push -u origin feat/nome-da-feature
```

Mensagem: **uma linha, em inglês**, `tipo: descrição curta` (Conventional Commits).

| Tipo | Quando usar |
| --- | --- |
| `feat` | nova funcionalidade |
| `fix` | correção de bug |
| `refactor` | muda código sem mudar comportamento |
| `test` | testes |
| `docs` | documentação |
| `style` | formatação |
| `build` | Dockerfile, dependências, Makefile |
| `chore` | tarefas gerais |

Exemplos: `fix: handle expired session`, `build: add axios to backend`.

