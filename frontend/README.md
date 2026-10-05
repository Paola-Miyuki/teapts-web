# Frontend (Next.js)

Interface web do TEA-PTS: Next.js 16 (App Router) + React 19, estilos com
Tailwind CSS v4 e CSS Modules, autenticação pelo SDK web do SuperTokens.

Este arquivo cobre só o que é do código do frontend. Para rodar a stack
(banco, SuperTokens, backend), use o [README da raiz](../README.md); o fluxo
de login do lado da API está na seção 6 ("Autenticação") de lá.

## Rodar

Com o backend no ar em `http://localhost:3000`:

```bash
cp .env.example .env    # ou make env na raiz
pnpm install
pnpm dev -p 3001        # http://localhost:3001 (login em /login)
```

Use a porta 3001: o backend libera CORS e cookies só para
`WEBSITE_DOMAIN` (padrão `http://localhost:3001`). O `PORT` do `.env` não
vale para o `next dev`, que sobe o servidor antes de ler o `.env`.

Conta para testar o login: `teste@teapts.local` / `teapts123`, criada pelo
seed (seção 5.2 do README da raiz).

> **Next 16 tem mudanças incompatíveis** com versões anteriores. Antes de
> escrever código, confira o guia em `node_modules/next/dist/docs/`.

## Scripts

| Script                             | O que faz                                    |
| ---------------------------------- | -------------------------------------------- |
| `dev`                              | servidor de desenvolvimento (use `-p 3001`)  |
| `build` / `start`                  | build de produção / serve o build            |
| `test` / `test:cov` / `test:watch` | Jest + Testing Library (jsdom)               |
| `lint` / `typecheck`               | ESLint / `tsc --noEmit`                      |
| `format` / `format:check`          | Prettier, alterando ou só conferindo         |

## Variáveis de ambiente

| Variável              | Padrão                  | Uso                                              |
| --------------------- | ----------------------- | ------------------------------------------------ |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000` | endereço da API usado pelo SDK                   |
| `PORT`                | `3001`                  | ignorado pelo `next dev` (use `-p 3001`)         |

As `NEXT_PUBLIC_*` entram no bundle no build: mudou o `.env`, pare o
`pnpm dev` e suba de novo.

## Estrutura

```
src/
  app/
    layout.tsx             layout raiz e fontes
    globals.css            @import 'tailwindcss' e estilos globais
    page.tsx               página inicial
    login/
      page.tsx             tela de login (EmailPassword.signIn)
      login.module.css     estilos da tela
      page.test.tsx        testes da tela
  lib/
    supertokens.ts         initSuperTokens(): configura o SDK uma vez
design/                    layouts de referência (HTML estático)
public/                    arquivos servidos na raiz do site
```

O alias `@/` aponta para `src/` (no `tsconfig.json` e no `jest.config.ts`).

## Layouts (`design/`)

As telas a implementar estão em `design/` como HTML estático. Abra
`design/index.html` no navegador para ver todas; as cores, fontes e regras da
marca estão em `design/brand-spec.md`. Use esses arquivos como referência
visual: não importe nada de `design/` no código do app.

## Estilos

- **Tailwind CSS v4**: ligado pelo `postcss.config.mjs` (plugin
  `@tailwindcss/postcss`) e pelo `@import 'tailwindcss'` em `globals.css`.
  Não há `tailwind.config.js`; personalizações vão no CSS, com `@theme`.
- **CSS Modules** (`*.module.css`) para estilos de uma tela, como no login.

## Autenticação

O SDK `supertokens-web-js` já está configurado em `src/lib/supertokens.ts`.
Chame `initSuperTokens()` antes de usar o SDK; `src/app/login/page.tsx` é o
exemplo.

- **Login pelo SDK**, com `EmailPassword.signIn({ formFields: [...] })`. Não
  chame `/auth/signin` com `fetch`/Axios na mão.
- **Decida pelo `response.status`, não pelo HTTP**: a API responde `200`
  mesmo com credenciais erradas.
  - `OK`: login feito, o SDK já guardou a sessão;
  - `WRONG_CREDENTIALS_ERROR`: mostre exatamente `E-mail ou senha inválidos.`,
    sem dizer qual campo errou;
  - qualquer outro: mensagem genérica de erro.
- **A sessão fica em cookies `HttpOnly`**: o frontend não lê os cookies, não
  guarda token no `localStorage` e não monta header `Authorization`.
- **Chamadas à API precisam enviar os cookies**, porque frontend e API estão
  em origens diferentes:

  ```ts
  // fetch
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/me`, {
    credentials: 'include',
  });

  // Axios
  const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    withCredentials: true,
  });
  ```

- **`GET /me` com `401`** significa usuário deslogado: redirecione para
  `/login`.

O formato da resposta do `/me` e os demais status estão na seção 6 do README
da raiz.

## Testes

Jest com `next/jest`, ambiente `jsdom` e Testing Library. Os testes ficam ao
lado do componente (`*.test.tsx`) e mocam o SDK do SuperTokens e o
`next/navigation`; veja `src/app/login/page.test.tsx`.
