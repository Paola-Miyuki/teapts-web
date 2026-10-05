SHELL := /bin/bash
.DEFAULT_GOAL := help

.PHONY: help env install \
	up up-d up-d-db wait-backend rebuild rebuild-no-cache rebuild-backend rebuild-frontend rebuild-frontend-no-cache \
	restart restart-backend restart-frontend down clean ps health \
	logs logs-backend logs-frontend logs-db \
	shell-backend shell-frontend psql \
	migrate migrate-revert migrate-show migrate-generate seed \
	db-tables db-account db-query \
	test test-e2e typecheck lint format format-check check

# Variáveis
DC       := docker compose --env-file backend/.env
ENV_DIRS := backend frontend

# Containers (nomes fixos no docker-compose.yml): usados nos alvos
# interativos, que assim nao dependem do backend/.env
C_BACKEND  := teapts-backend
C_FRONTEND := teapts-frontend
C_POSTGRES := teapts-postgres

# Atalhos para rodar scripts pnpm no HOST. Nao use `docker compose exec`: as
# imagens nao montam o codigo, entao exec validaria o que esta na imagem, nao
# o que voce acabou de editar.
BE := pnpm --dir backend run
FE := pnpm --dir frontend run

# Alvos de banco no container
BE_DB      := docker exec -e DATABASE_HOST=postgres $(C_BACKEND)
BE_TYPEORM := $(BE_DB) node_modules/.bin/typeorm
BE_DS      := -d dist/database/data-source.js

# Porta publicada pelo backend: espelha o ${PORT:-3000} do docker-compose.yml
BACKEND_PORT := $(shell sed -n 's/^PORT=\([0-9]\{1,\}\).*/\1/p' backend/.env 2>/dev/null | tail -1)
BACKEND_PORT := $(if $(BACKEND_PORT),$(BACKEND_PORT),3000)

##@ Ajuda

help: ## Mostra esta mensagem de ajuda
	@awk 'BEGIN {FS = ":.*##"; printf "\nUso: make \033[36m<alvo>\033[0m\n"} \
		/^[a-zA-Z0-9_-]+:.*##/ { printf "  \033[36m%-26s\033[0m %s\n", $$1, $$2 } \
		/^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) }' $(MAKEFILE_LIST)

##@ Setup

env: ## Cria backend/.env e frontend/.env a partir do .env.example (não sobrescreve)
	@for dir in $(ENV_DIRS); do \
		if [ -f $$dir/.env ]; then \
			echo "$$dir/.env já existe. Nenhuma alteração feita."; \
		elif [ -f $$dir/.env.example ]; then \
			cp $$dir/.env.example $$dir/.env; \
			echo "$$dir/.env criado a partir do .env.example. Preencha os valores necessários."; \
		else \
			echo "ERRO: $$dir/.env.example não encontrado."; \
			exit 1; \
		fi; \
	done

install: ## Instala as dependências na máquina e registra os hooks do Husky
	pnpm --dir backend install
	pnpm --dir frontend install

##@ Ambiente (Docker)

up: up-d ## Sobe todos os serviços, aplica as migrations e acompanha os logs
	$(DC) logs -f

up-d: env ## Sobe todos os serviços em segundo plano e aplica as migrations
	$(DC) up -d
	@$(MAKE) --no-print-directory wait-backend
	@$(MAKE) --no-print-directory migrate

rebuild: env ## Rebuilda as imagens, sobe tudo e aplica as migrations
	$(DC) up -d --build
	@$(MAKE) --no-print-directory wait-backend
	@$(MAKE) --no-print-directory migrate

rebuild-no-cache: env ## Reconstrói as imagens sem cache, sobe tudo e aplica as migrations
	$(DC) build --no-cache
	$(DC) up -d
	@$(MAKE) --no-print-directory wait-backend
	@$(MAKE) --no-print-directory migrate

# Alvo interno (sem ## para nao aparecer no help): os alvos de banco usam
# `docker exec`, que exige o container do backend ja saudavel. O healthcheck
# do compose bate em GET /health, ou seja, Nest no ar e SELECT 1 passando.
wait-backend:
	@for i in $$(seq 1 60); do \
		case "$$(docker inspect -f '{{.State.Health.Status}}' $(C_BACKEND) 2>/dev/null)" in \
			healthy) exit 0 ;; \
			unhealthy) echo "ERRO: $(C_BACKEND) esta unhealthy. Veja 'make logs-backend'."; exit 1 ;; \
		esac; \
		sleep 2; \
	done; \
	echo "ERRO: $(C_BACKEND) nao ficou saudavel em 120s. Veja 'make logs-backend'."; \
	exit 1

rebuild-backend: env ## Rebuilda só a imagem do backend e aplica as migrations
	$(DC) up -d --build backend
	@$(MAKE) --no-print-directory wait-backend
	@$(MAKE) --no-print-directory migrate

rebuild-frontend: env ## Rebuilda só a imagem do frontend (necessário depois de mudar dependências)
	$(DC) up -d --build frontend

rebuild-frontend-no-cache: env ## Rebuilda o frontend sem cache (obrigatório depois de mudar frontend/.env)
	$(DC) build --no-cache frontend
	$(DC) up -d frontend

restart: ## Inicia backend e frontend parados; reinicia os que já estão rodando (sem rebuildar)
	$(DC) restart

restart-backend: ## Reinicia só o backend
	$(DC) restart backend

restart-frontend: ## Reinicia só o frontend
	$(DC) restart frontend

down: ## Para e remove os containers (os dados do banco ficam)
	$(DC) down --remove-orphans

clean: ## Para tudo e APAGA os volumes, inclusive o banco (pede confirmação)
	@read -p "Isso APAGA o banco de dados e os volumes. Continuar? [y/N] " ans; \
	case "$$ans" in \
		y|Y|s|S) $(DC) down -v --remove-orphans ;; \
		*) echo "Cancelado." ;; \
	esac

ps: ## Lista o status dos serviços
	$(DC) ps

health: ## Chama o GET /health do backend (usa PORT do backend/.env, padrão 3000)
	@curl -fsS http://localhost:$(BACKEND_PORT)/health && echo

## Para desenvolvimento
up-d-db: env ## Sobe só o Postgres e o SuperTokens (para rodar backend/frontend na máquina)
	$(DC) up -d postgres supertokens

stop: ## Para os containers backend e frontend, mantendo Postgres e SuperTokens
	$(DC) stop backend frontend

start: ## Inicia os containers backend e frontend existentes (sem rebuild)
	$(DC) start backend frontend


##@ Logs e acesso

logs: ## Acompanha os logs de todos os serviços
	$(DC) logs -f

logs-backend: ## Acompanha os logs do backend
	$(DC) logs -f backend

logs-frontend: ## Acompanha os logs do frontend
	$(DC) logs -f frontend

logs-db: ## Acompanha os logs do Postgres
	$(DC) logs -f postgres

shell-backend: ## Abre um shell no container do backend
	docker exec -it $(C_BACKEND) sh

shell-frontend: ## Abre um shell no container do frontend
	docker exec -it $(C_FRONTEND) sh

psql: ## Abre o psql no banco de dados
	docker exec -it $(C_POSTGRES) sh -c 'exec psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

##@ Banco de dados (no container do backend)

migrate: ## Aplica as migrations pendentes
	$(BE_TYPEORM) migration:run $(BE_DS)

migrate-revert: ## Desfaz a última migration aplicada
	$(BE_TYPEORM) migration:revert $(BE_DS)

migrate-show: ## Lista as migrations e marca com [X] as já aplicadas
	$(BE_TYPEORM) migration:show $(BE_DS)

# Roda no HOST de proposito: sem mount de codigo, a migration gerada dentro do
# container se perderia no proximo rebuild. Precisa do Postgres alcancavel da
# maquina (`make up-d-db`).
migrate-generate: ## Gera migration a partir das entidades, no host (uso: make migrate-generate NAME=AddFoo)
	@test -n "$(NAME)" || { echo "ERRO: informe NAME, ex.: make migrate-generate NAME=AddFoo"; exit 1; }
	$(BE) migration:generate src/database/migrations/$(NAME)

seed: ## Cria a conta de teste (teste@teapts.local / teapts123)
	$(BE_DB) node dist/database/seeds/create-test-user.js

db-tables: ## Lista as tabelas do banco
	docker exec -t $(C_POSTGRES) sh -c 'exec psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" -c "\\dt"'

db-account: ## Mostra as contas da tabela account
	docker exec -t $(C_POSTGRES) sh -c 'exec psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" -c "SELECT id, name, email, role, \"createdAt\" FROM account;"'

db-query: ## Roda um SQL no banco (uso: make db-query SQL="select * from account")
	@test -n "$(SQL)" || { echo 'ERRO: informe SQL, ex.: make db-query SQL="\dt"'; exit 1; }
	@docker exec -t $(C_POSTGRES) sh -c 'exec psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" -c "$$1"' sh "$(SQL)"

##@ Testes e qualidade (rodam no host, contra o código do working tree)

test: ## Executa os testes unitários do backend e do frontend
	$(BE) test --runInBand
	$(FE) test --runInBand

test-e2e: ## Executa os testes e2e do backend
	$(BE) test:e2e

typecheck: ## Verifica os tipos no backend e no frontend
	$(BE) typecheck
	$(FE) typecheck

lint: ## Roda o lint no backend e no frontend
	$(BE) lint
	$(FE) lint

format: ## Formata o código com Prettier (backend e frontend)
	$(BE) format
	$(FE) format

format-check: ## Verifica a formatação sem alterar arquivos
	$(BE) format:check
	$(FE) format:check

check: format lint typecheck test ## Formata (altera arquivos), roda lint, tipos e testes no host: use antes do commit
