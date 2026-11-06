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

| Script                             | O que faz                                   |
| ---------------------------------- | ------------------------------------------- |
| `dev`                              | servidor de desenvolvimento (use `-p 3001`) |
| `build` / `start`                  | build de produção / serve o build           |
| `test` / `test:cov` / `test:watch` | Jest + Testing Library (jsdom)              |
| `lint` / `typecheck`               | ESLint / `tsc --noEmit`                     |
| `format` / `format:check`          | Prettier, alterando ou só conferindo        |

## Variáveis de ambiente

| Variável              | Padrão                  | Uso                                      |
| --------------------- | ----------------------- | ---------------------------------------- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000` | endereço da API usado pelo SDK           |
| `PORT`                | `3001`                  | ignorado pelo `next dev` (use `-p 3001`) |

As `NEXT_PUBLIC_*` entram no bundle no build: mudou o `.env`, pare o
`pnpm dev` e suba de novo.

## Estrutura

```
src/
  app/
    layout.tsx             layout raiz e fontes
    globals.css            @import 'tailwindcss' e estilos globais
    page.tsx               redireciona para /home
    login/
      page.tsx             tela de login (EmailPassword.signIn)
      login.module.css     estilos da tela
      page.test.tsx        testes da tela
    signup/                cadastro de conta (EmailPassword.signUp); volta para /login?registered=true
    home/                  início por perfil: área de trabalho, "Meu cuidado" do paciente ou
                           "Aguardando perfil" para a conta sem perfil
    profile/               meu perfil: dados da conta (GET/PATCH /me) e troca de senha
                           (POST /me/password)
    professionals/         consulta de profissionais (GET /professionals) com filtros de nome e
                           especialidade e paginação
    pts/
      novo/                criar proposta de PTS: paciente (GET /patients/available-for-pts),
                           equipe (GET /professionals) e POST /pts; o admin escolhe o profissional
                           responsável
      proposals/           propostas de PTS do paciente (GET /pts/proposals?patientId=); o
                           profissional e o admin escolhem o paciente (GET /patients/authorized) e o
                           paciente (ou o admin, em nome dele) aprova ou rejeita (POST /pts/proposals/:id/approve e /reject)
    patients/              pacientes (só admin): lista (GET /accounts?isPatient=true) com busca por nome ou
                           e-mail (termo em /patients?q=) e modal "Adicionar paciente"
      _components/         PatientSearch e PatientList (busca `q`, página 1 ao mudar o termo, resultados
                           anteriores mantidos no carregamento), AddPatientModal/AddPatientForm,
                           AccountCombobox (combobox ARIA da conta: GET /accounts?isPatient=false&
                           isProfessional=false&q=; POST /patients) e SupportContactFields/SupportContactList
  components/              AppShell (sidebar e cabeçalho), AuthenticatedPage (sessão, perfil e
                           "Acesso restrito"), LogoutButton, HelpTooltip, Icon e Logo
  hooks/
    useAccount.ts          GET /me da sessão
    useDebouncedSearch.ts  busca da NFUS003: debounce de 300 ms, trim, mínimo de 2 caracteres, Enter
                           busca na hora, clear(); use nas telas com busca por texto
  lib/
    supertokens.ts         initSuperTokens(): configura o SDK uma vez
    api.ts                 apiFetch/request<T> com cookies; ApiError com status, code e apiMessage
    account.ts             GET /me, PATCH /me, POST /me/password e menu por perfil
    permissions.ts         matriz de permissões por perfil: can(account, ação, contexto)
    professionals.ts       GET /professionals
    patients.ts            contas com perfil de paciente e sem perfil de paciente nem profissional (com `q` e
                           `signal` para cancelar), cadastro do perfil e isValidPhone
design/                    layouts de referência (HTML estático)
public/                    arquivos servidos na raiz do site
```

O alias `@/` aponta para `src/` (no `tsconfig.json` e no `jest.config.ts`).

O `request<T>` de `lib/api.ts` lança `ApiError` quando a resposta não é 2xx.
Além do `status` HTTP, ele guarda o `code` e a `apiMessage` do corpo de erro
`{ status, message }` da API, quando existem (ex.: `409`
`PATIENT_PROFILE_ALREADY_EXISTS`). Use a `apiMessage` para mostrar o erro ao
usuário, com um texto padrão quando ela não vier.

## Telas

Toda tela autenticada usa `AuthenticatedPage`: sem sessão, vai para `/login`;
sem a permissão de `requiredAction` (`src/lib/permissions.ts`), mostra
"Acesso restrito". O admin tem todas as permissões (RN022), menos
`viewOwnCare` e `viewWaitingHome`, que só escolhem o início, e aprovar ou
rejeitar continua só em proposta `draft`. O menu lateral sai de `getNavigation` (`src/lib/account.ts`).

| Rota | Tela | Acesso (`requiredAction`) | Layout |
| --- | --- | --- | --- |
| `/` | redireciona para `/home` | — | — |
| `/login` | Entrar | pública | `teapts-login.html` |
| `/signup` | Criar conta | pública | `cadastro.html` |
| `/home` | Início, Meu cuidado ou Aguardando perfil | conta da sessão | `inicio-paciente.html`, `aguardando-perfil.html` |
| `/profile` | Meu perfil | conta da sessão | `meu-perfil.html` |
| `/patients` | Pacientes cadastrados e "Adicionar paciente" | admin (`viewPatientRegistry`) | `pacientes.html`, `criar-paciente.html` |
| `/professionals` | Profissionais | admin e profissional (`viewProfessionalDirectory`) | — |
| `/pts/proposals` | Propostas de PTS | paciente, profissional da proposta e admin (`viewPtsProposals`) | `propostas-pts.html` |
| `/pts/novo` | Criar proposta de PTS | profissional e admin (`createPts`) | `criar-pts.html` |

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
  O que mais de uma tela usa (modal, botão de ícone, campo de senha com
  requisitos) fica em `components/ui.module.css`; uma tela não importa o CSS
  de outra.
- **`<dialog>`**: o preflight do Tailwind zera o `margin` de todo elemento,
  inclusive o `margin: auto` que centraliza o modal. Ponha `margin: auto` na
  classe do dialog (ex.: `.dialog` em `components/ui.module.css`).

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
da raiz. O contrato completo da API (rotas, corpos e respostas) está no
Swagger do backend, em `http://localhost:3000/docs`.

## Testes

Jest com `next/jest`, ambiente `jsdom` e Testing Library. Os testes ficam ao
lado do componente (`*.test.tsx`) e mocam o SDK do SuperTokens e o
`next/navigation`; veja `src/app/login/page.test.tsx`.

O jsdom não implementa `showModal()`/`close()` do `<dialog>`; o
`jest.setup.ts` os substitui para os testes de modal (ex.:
`src/app/patients/page.test.tsx`).
