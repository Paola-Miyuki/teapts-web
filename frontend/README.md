# Frontend (Next.js)

Interface web do TEAPTS: Next.js (App Router) + React + Tailwind CSS v4.

## Requisitos

- Node >= 22.12 e `pnpm`
- Backend no ar para as telas que consomem a API (`NEXT_PUBLIC_API_URL`)

## Setup

```bash
cp .env.example .env
pnpm install
```

O `pnpm install` também registra os hooks do Git: o `prepare` aponta o
`core.hooksPath` para `.husky/` na raiz do repositório, que roda o lint e o
format:check dos dois projetos e um único commitlint na mensagem de commit.

## Executar

```bash
pnpm dev -p 3001     # http://localhost:3001
pnpm build
pnpm start
```

## Qualidade

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:cov
```

## Estrutura

```
src/app/            App Router (layout, páginas, globals.css)
design/             layouts estáticos de referência (HTML/CSS/JS puro)
```

`design/` é material de referência para implementar as telas: fica fora do
lint e do Prettier.
