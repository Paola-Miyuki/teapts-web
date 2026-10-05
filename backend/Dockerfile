# ---------------------------------------------------------------------------
# builder: instala tudo (dependências + devDependencies) e compila para dist/
# ---------------------------------------------------------------------------
FROM node:24-slim AS builder

WORKDIR /app

# Instala explicitamente: não depende de Corepack incluído na imagem Node.
# Mantenha esta versão alinhada com engines.pnpm de package.json.
RUN npm install --global pnpm@12.9.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# --prod=false é explícito: o build precisa das devDependencies, e um
# NODE_ENV=production herdado do ambiente faria o pnpm omiti-las.
RUN pnpm install --frozen-lockfile --prod=false

COPY . .

# tsconfig.build.json usa rootDir ./src, então a saída é sempre dist/main.js.
# O test falha o build aqui em vez de falhar o container em produção.
RUN pnpm run build && test -f dist/main.js

# ---------------------------------------------------------------------------
# deps: só as 9 dependências de produção, em árvore separada
# ---------------------------------------------------------------------------
FROM node:24-slim AS deps

WORKDIR /app

RUN npm install --global pnpm@12.9.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

# ---------------------------------------------------------------------------
# runtime: dist + dependências de produção. Sem pnpm, sem TypeScript,
# sem ts-node, sem test runner.
# ---------------------------------------------------------------------------
FROM node:24-slim

WORKDIR /app

ENV NODE_ENV=production

# --chown evita o `chown -R` numa camada à parte, que duplicaria node_modules.
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./

USER node

# Porta padrão da imagem. Se PORT mudar no .env, é o Compose que publica o
# valor novo; este EXPOSE é só documentação.
EXPOSE 3000

CMD ["node", "dist/main.js"]
