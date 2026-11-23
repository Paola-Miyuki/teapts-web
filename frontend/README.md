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
    layout.tsx             layout raiz, fontes e as folhas globais de styles/
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
    professionals/         profissionais (GET /professionals) na tabela de `profissionais.html`:
                           busca por nome, filtro de especialidade e paginação
    pts/
      novo/                criar proposta de PTS: paciente buscado pelo nome
                           (GET /patients/available-for-pts?name=, paginação padrão),
                           equipe (GET /professionals) e POST /pts; o admin escolhe o profissional
                           responsável
      proposals/           propostas de PTS do paciente (GET /pts/proposals?patientId=); o
                           profissional e o admin escolhem o paciente (GET /patients/authorized) e o
                           paciente (ou o admin, em nome dele) aprova ou rejeita (POST /pts/proposals/:id/approve e /reject)
    patients/              pacientes do admin (todos) e do profissional (RN016): tabela de
                           `pacientes.html` (GET /patients/authorized) com busca `q`, filtros de
                           status do PTS, responsável e data de cadastro, ordenação e paginação,
                           todos na URL; modal "Adicionar paciente" (só admin)
      [id]/                detalhe do paciente (GET /patients/:id), aba Dados do paciente
      _components/         PatientList (tabela, filtros e menu ⋮ com "Visualizar"),
                           AddPatientModal/AddPatientForm, AccountCombobox (combobox ARIA da conta:
                           GET /accounts?isPatient=false&isProfessional=false&q=; POST /patients) e
                           SupportContactFields/SupportContactList
  components/              AppShell (sidebar e cabeçalho), AuthenticatedPage (sessão, perfil e
                           "Acesso restrito"), LogoutButton, HelpTooltip, Icon e Logo
    table/                 peças das tabelas dos mockups: KebabMenu (menu ⋮), MultiSelect,
                           Pagination (faixa, páginas e itens por página) e PtsStatusBadge
  styles/                  teapts-mockups.css e teapts-ui.css: classes globais dos mockups
                           (cópia de design/assets, sem as regras só do mockup)
  hooks/
    useAccount.ts          GET /me da sessão
    useDebouncedSearch.ts  busca da NFUS003: debounce de 300 ms, trim, mínimo de 2 caracteres, Enter
                           busca na hora, clear(); use nas telas com busca por texto
  lib/
    supertokens.ts         initSuperTokens(): configura o SDK uma vez
    api.ts                 apiFetch/request<T> com cookies; ApiError com status, code e apiMessage
    account.ts             GET /me, PATCH /me, POST /me/password e menu por perfil
    permissions.ts         matriz de permissões por perfil: can(account, ação, contexto)
    professionals.ts       GET /professionals (o e-mail vem `null` para quem não é admin nem profissional)
    patients.ts            lista (getPatients) e detalhe (getPatient) dos pacientes, contas sem perfil
                           (com `q` e `signal`), cadastro do perfil e isValidPhone
    pts-status.ts          status do PTS e rótulos das telas
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
| `/home` | Início, Meu cuidado ou Aguardando perfil | conta da sessão | `inicio.html`, `inicio-paciente.html`, `aguardando-perfil.html` |
| `/profile` | Meu perfil | conta da sessão | `meu-perfil.html` |
| `/patients` | Pacientes cadastrados (admin) ou vinculados (profissional) e "Adicionar paciente" | admin e profissional (`viewAuthorizedPatients`) | `pacientes.html`, `criar-paciente.html` |
| `/patients/:id` | Detalhe do paciente (Dados do paciente) | admin e profissional com acesso (RN016) | `paciente.html` |
| `/professionals` | Profissionais | admin e profissional (`viewProfessionalDirectory`) | `profissionais.html` |
| `/pts/proposals` | Propostas de PTS | paciente, profissional da proposta e admin (`viewPtsProposals`) | `propostas-pts.html` |
| `/pts/novo` | Criar proposta de PTS | profissional e admin (`createPts`) | `criar-pts.html` |

## Layouts (`design/`)

As telas a implementar estão em `design/` como HTML estático. Abra
`design/index.html` no navegador para ver todas; as cores, fontes e regras da
marca estão em `design/brand-spec.md`. Use esses arquivos como referência
visual: não importe nada de `design/` no código do app.

Todas as telas são mockups com dados fixos, com o shell do `AppShell` e os
estilos em `assets/teapts-mockups.css` e `assets/teapts-mockups.js`. O índice
separa dois grupos:

- **Listagens e detalhes** (`contas.html`, `pacientes.html`, `profissionais.html`,
  `lista-pts.html`, `paciente.html`, `prontuario.html`, `pts-detalhe.html`):
  seguem `.dev/telas-listagem.md`. Visualizar, criar, editar e excluir abrem
  modais (exclusões pedem confirmação); visualizar de paciente abre o
  prontuário (`paciente.html`), com todos os dados do paciente em abas (Dados
  do paciente, Histórico de PTS, Atendimentos, Medicações, Documentos e Termos e
  consentimentos); `prontuario.html` só abre a aba Documentos de `paciente.html`. O detalhe do PTS
  tem o cartão do PTS em todas as abas e, embaixo dele, as abas (Visão geral,
  Metas terapêuticas, Equipe, Atividades, Atendimentos e Timeline); há um
  segundo exemplo em planejamento (`pts-planejamento.html`), e toda edição de
  PTS abre `editar-pts.html`; os atendimentos usam o formato SOAP.
- **Fluxos** (`teapts-login.html`, `cadastro.html`, `aguardando-perfil.html`,
  `inicio.html`, `inicio-paciente.html`, `meu-perfil.html`, `criar-paciente.html`,
  `criar-pts.html`, `propostas-pts.html`, `pts.html` (no modelo do detalhe do PTS, com as abas Timeline e Histórico de PTS; os PTS antigos abrem em `pts-anterior.html`; `historico.html` só abre a aba Timeline),
  `enviar-documento.html`): seguem a marcação e os estilos das telas do front
  (`login.module.css`, `signup.module.css`, `ui.module.css` etc.).
  `criar-paciente.html` é a página "Adicionar paciente". Nos formulários, só
  o campo obrigatório leva *; o opcional não tem marca. Nenhum texto fica
  embaixo do campo: o exemplo vai no placeholder e a explicação, no "?" ao
  lado da label. Botões de excluir e desativar são vermelhos.

A barra tracejada no topo é só do mockup e só aparece nas telas com mais de um
papel ou com variantes: troca o papel ("Ver como"), o cenário do paciente (sem
ou com PTS ativo) e as opções das decisões pendentes (DPs) da tela.

## Estilos

- **Tailwind CSS v4**: ligado pelo `postcss.config.mjs` (plugin
  `@tailwindcss/postcss`) e pelo `@import 'tailwindcss'` em `globals.css`.
  Não há `tailwind.config.js`; personalizações vão no CSS, com `@theme`.
- **Classes dos mockups**: `src/styles/teapts-mockups.css` e
  `src/styles/teapts-ui.css` são cópias de `design/assets/` (sem as regras
  só do mockup, como a `mockbar`), importadas no `layout.tsx`. As telas novas
  usam as mesmas classes globais do HTML de `design/` (`ux-tcard`,
  `ux-toolbar`, `table`, `badge <status>`, `kebab-menu` etc.). Ao mudar o
  CSS de `design/assets/`, copie de novo.
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
