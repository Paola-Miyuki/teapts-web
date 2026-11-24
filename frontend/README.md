# Frontend (Next.js)

Interface web do TEA-PTS: Next.js 16 (App Router) + React 19, Tailwind v4 e CSS Modules, SuperTokens (SDK web). Para subir a stack, veja o [README da raiz](../README.md).

> Next 16 tem mudanças incompatíveis: confira o guia em `node_modules/next/dist/docs/` antes de escrever código.

## Rodar

Com o backend no ar: `make env`, `pnpm install` e `pnpm dev -p 3001` (use a porta 3001: o CORS do backend só libera `WEBSITE_DOMAIN`). Login em `/login`, com `teste@teapts.local` / `teapts123`.

Scripts: `dev`, `build`, `start`, `test`, `test:cov`, `lint`, `typecheck`, `format`. Variável: `NEXT_PUBLIC_API_URL` (`http://localhost:3000`); mudou o `.env`, reinicie o `pnpm dev`.

## Estrutura

```text
src/
  app/            rotas; `_components/` guarda os componentes de cada tela
    login/ signup/ home/ profile/ accounts/ professionals/ medications/
    patients/     lista e [patientId]/ (+ pts/)
    pts/          Meu PTS, [ptsId]/ (+ edit/), novo/, proposals/ ([proposalId]/edit/)
  components/     AppShell, AuthenticatedPage, Modal, ... (+ pts/, table/)
  hooks/  lib/    lib: clientes da API, permissions.ts, supertokens.ts
  styles/         cópias de design/assets/
design/           mockups HTML de referência (abra design/index.html)
```

## Rotas

Toda tela autenticada usa `AuthenticatedPage`: sem sessão vai para `/login`; sem a permissão de `requiredAction` (`src/lib/permissions.ts`) mostra "Acesso restrito". O admin tem todas (RN022), menos as de escolha do início.

| Rota                        | Tela                                            | Acesso                                         | Layout (`design/`)                               |
| --------------------------- | ----------------------------------------------- | ---------------------------------------------- | ------------------------------------------------ |
| `/login`, `/signup`         | Entrar, Criar conta                             | pública                                        | `teapts-login`, `cadastro`                       |
| `/home`                     | Início por perfil ou Aguardando aprovação       | conta da sessão                                | `inicio`, `inicio-paciente`, `aguardando-perfil` |
| `/profile`, `/profile/edit` | Meu perfil, Editar perfil e senha               | conta da sessão                                | `meu-perfil`, `meu-perfil-editar`                |
| `/accounts`                 | Contas: ver, tornar paciente, desativar         | admin                                          | `contas`                                         |
| `/patients`                 | Pacientes e "Adicionar paciente"                | admin e profissional                           | `pacientes`, `criar-paciente`                    |
| `/patients/:id`             | Dados, Medicações e contatos de suporte         | admin e profissional com acesso                | `paciente`                                       |
| `/patients/:id/pts`         | PTS ativo do paciente                           | equipe e admin                                 | `pts-detalhe`                                    |
| `/medications`              | Minhas medicações                               | paciente                                       | `paciente`                                       |
| `/professionals`            | Profissionais                                   | admin e profissional                           | `profissionais`                                  |
| `/pts`                      | Meu PTS: PTS ativo, equipe e Timeline           | paciente titular e equipe                      | `pts`                                            |
| `/pts/:id`                  | Detalhe: Visão geral (ficha), Equipe e Timeline | admin, equipe e paciente titular (sem a ficha) | `pts-detalhe`, `pts`                             |
| `/pts/:id/edit`             | Editar PTS em 3 passos                          | equipe e admin, PTS ativo                      | `editar-pts`                                     |
| `/pts/novo`                 | Criar proposta                                  | profissional e admin                           | `criar-pts`                                      |
| `/pts/proposals`            | Propostas                                       | paciente, profissional da proposta e admin     | `propostas-pts`                                  |
| `/pts/proposals/:id/edit`   | Editar proposta                                 | responsável ou admin, `draft`                  | `editar-proposta`                                |

## Convenções

- **Estilos:** use as classes globais dos mockups (`src/styles/`, cópias de `design/assets/`; copie de novo ao mudar o original) e CSS Modules para o que é de uma tela. O que várias telas usam fica em `components/ui.module.css`. Modais usam `components/Modal.tsx`.
- **Autenticação:** login pelo SDK (`EmailPassword.signIn`), decidindo pelo `response.status` (`OK` ou `WRONG_CREDENTIALS_ERROR`, que mostra `E-mail ou senha inválidos.`). A sessão fica em cookies `HttpOnly`: toda chamada à API usa `credentials: 'include'`, e `401` redireciona para `/login`.
- **Testes:** Jest + Testing Library (jsdom), ao lado do componente (`*.test.tsx`); mocam o SuperTokens e o `next/navigation`.
