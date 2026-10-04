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

Depois do `make env`, abra `backend/.env` e **preencha `DATABASE_PASSWORD`**. Vale também fixar `SUPERTOKENS_VERSION`: o padrão é `latest`, que não é reproduzível. Os `.env` nunca são sobrescritos nem versionados — ao criar variável nova, atualize o `.env.example`.

---

## 3. Rodar local

**3.1 Suba só o banco e o SuperTokens:**

```bash
make up-d-db     # postgres + supertokens em segundo plano
make ps          # os dois devem estar "healthy"
```

**3.2 Confira o `backend/.env`:** use `DATABASE_HOST=localhost`. Os nomes `postgres` e `supertokens` só resolvem dentro da rede do Docker, e é o Compose que os injeta nos containers.

**3.3 Aplique as migrations** (ver [seção 5](#5-banco-de-dados)):

```bash
cd backend && pnpm migration:run
```

**3.4 Suba os dois serviços**, em terminais separados:

```bash
cd backend  && pnpm start:dev     # http://localhost:3000
cd frontend && pnpm dev -p 3001   # http://localhost:3001
```

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

Frontend em <http://localhost:3001>, backend em <http://localhost:3000>.

Todo alvo que sobe o backend (`up`, `up-d`, `rebuild`, `rebuild-no-cache`, `rebuild-backend`) espera o container ficar em execução e então roda `make migrate`. Se a migration falhar, o comando termina com erro **e os containers continuam no ar** — investigue com `make logs-backend` e rode `make migrate` de novo. `make up` sobe em segundo plano e segue os logs, então `Ctrl+C` só fecha os logs: para parar de verdade, use `make down`.

O que o `docker-compose.yml` garante:

- **Imagens multi-stage, sem mount de código:** o `pnpm install` e o build rodam num estágio descartado. A imagem final do backend tem só `dist/` e as 9 dependências de produção; a do frontend, só a saída `standalone` do Next. **Nem pnpm, nem TypeScript, nem ts-node, nem Jest.** O único volume é o `postgres_data`.
- **Sem hot reload:** o container serve o código que estava na imagem no momento do build.
- **O build do frontend precisa de rede:** `next/font/google` baixa as fontes durante o `next build`.
- **Banco no volume `postgres_data`:** sobrevive ao `make down`; só o `make clean` apaga.
- **Rede `teapts-network`:** os serviços se acham pelo nome (`postgres`, `supertokens`, `backend`).
- **Ordem de subida por healthcheck:** SuperTokens espera o Postgres saudável, o backend espera os dois, e o frontend espera o `GET /health` do backend passar. Nada sobe em cima de um serviço que ainda não responde.
- **Versão do SuperTokens vem do `.env`:** `SUPERTOKENS_VERSION` (padrão `latest`). Fixe uma versão — o core roda migrations no Postgres ao subir.
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
make seed                      # Docker
cd backend && pnpm seed:test-user   # local
```

Cria `teste@teapts.local` / `teapts123`, role `admin`, na tabela `account`. É idempotente: rodar de novo não duplica.

### 5.3 Testar se o banco está de pé

```bash
make db-tables                              # lista as tabelas (espere ver account e migrations)
make db-account                             # mostra as contas
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

Trocar `DATABASE_PASSWORD` **não** muda a senha de um banco já criado no volume: altere no PostgreSQL ou recrie o volume (com backup antes).

---

## 6. Testes e qualidade

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

Scripts disponíveis em `backend/` e `frontend/`:

| Ação | Comando |
| --- | --- |
| Testes | `test` |
| Watch | `test:watch` |
| Cobertura | `test:cov` |
| E2E (só backend) | `test:e2e` |
| Tipos | `typecheck` |
| Lint | `lint` |
| Formatar (altera arquivos) | `format` |

Os testes unitários e e2e **não precisam de banco**: a conexão é substituída por um stub.

---

## 7. Comandos make

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
| `make seed` | Cria a conta de teste |
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

## 8. Commits

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

---

## 9. Problemas comuns

| Sintoma | Solução |
| --- | --- |
| `relation "account" does not exist` | `make migrate` (ou `pnpm migration:run`) |
| Editou a entidade e a coluna não existe no banco | falta a migration: gere com `make migrate-generate NAME=...` e aplique com `make rebuild-backend` |
| Entidade/migration nova é ignorada | registre-a nos arrays de `backend/src/database/database.config.ts` |
| `executable file not found in $PATH: pnpm` no `docker exec` | esperado: a imagem de produção não tem pnpm. Use os alvos `make` de banco, ou rode no host |
| `Cannot find module` no container | imagem desatualizada: `make rebuild-backend` / `make rebuild-frontend` |
| `Cannot find module` na máquina | `make install` |
| `pnpm install` falha com `Permission denied` em `node_modules` | arquivos com dono `root`/`nobody`: `sudo rm -rf <projeto>/node_modules && make install` |
| Editou código e o container não mudou | é esperado: não há mount. `make rebuild-backend` / `make rebuild-frontend` |
| Migration nova não aparece no `make migrate-show` | ela está só no host. `make rebuild-backend` recompila e aplica |
| `make migrate-generate` falha ao conectar | ele roda no host: suba o banco com `make up-d-db` e deixe `DATABASE_HOST=localhost` |
| Backend local não conecta no banco | `DATABASE_HOST=localhost` no `backend/.env`; `make up-d-db`; `make ps` |
| `/health` responde `503` | o banco caiu ou as credenciais do `.env` mudaram |
| Mudou `frontend/.env` e o frontend usa o valor antigo | `make rebuild-frontend-no-cache` (as `NEXT_PUBLIC_*` são embutidas no build) |
| Erro de `.env` não encontrado | `make env` |
| Porta em uso (3000, 3001) ao rodar local | o container ocupa a porta: `make stop` libera e mantém o banco de pé; `make start` volta ao Docker |
| Porta em uso (5432, 3567) | pare o processo ou rode `make down` |
| Quer zerar o banco | `make clean && make up-d && make seed` |
