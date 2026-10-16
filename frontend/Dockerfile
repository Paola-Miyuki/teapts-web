# ---------------------------------------------------------------------------
# builder: instala tudo e gera .next/standalone
# ---------------------------------------------------------------------------
FROM node:24-slim AS builder

WORKDIR /app

# Use a mesma versão de pnpm no backend, frontend e ambiente de desenvolvimento.
# Mantenha alinhada com engines.pnpm de package.json.
RUN npm install --global pnpm@12.9.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# --prod=false é explícito: o `next build` precisa das devDependencies, e um
# NODE_ENV=production herdado do ambiente faria o pnpm omiti-las.
RUN pnpm install --frozen-lockfile --prod=false

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# Next.js incorpora NEXT_PUBLIC_* no build. O .env é montado apenas neste RUN.
# O build baixa as fontes de next/font/google: precisa de rede.
RUN --mount=type=secret,id=frontend_env,target=/app/.env,required=true \
    NODE_ENV=production pnpm run build && \
    test -f .next/standalone/server.js

# ---------------------------------------------------------------------------
# runtime: só a saída standalone. Sem pnpm e sem node_modules completo.
# ---------------------------------------------------------------------------
FROM node:24-slim

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

# standalone traz server.js e só os módulos que o servidor carrega.
# static/ fica fora do standalone e precisa ser copiado à parte.
# Este projeto não tem frontend/public/, então não há o terceiro COPY de praxe.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node

EXPOSE 3001

CMD ["node", "server.js"]
