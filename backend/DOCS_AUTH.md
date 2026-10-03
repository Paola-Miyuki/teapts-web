# Fluxo de autenticação

## Diagrama

```text
POST /auth/signin
  |
  v
EmailPassword.signInPOST
  |
  | marca userContext[teapts.signInContext] = true
  v
Session.createNewSession
  |
  | resolveAccountContext(supertokensUserId)
  v
accounts
  |\
  | +-- conta encontrada -> contexto no access token -> sessão criada
  |
  +---- conta ausente ----> AccountIntegrityError -> HTTP 500 sem sessão

requisição protegida
  |
  v
AuthGuard -> verifySession -> parseAccountContext
  |
  v
GET /me -> AccountsService.findById -> resposta da conta
```

## Arquivos e responsabilidades

- `src/auth/supertokens.service.ts`: inicializa os recipes e sobrescreve
  `signInPOST` e `createNewSession`.
- `src/accounts/accounts.service.ts`: localiza a conta de negócio e monta o
  contexto mínimo da sessão.
- `src/accounts/account.entity.ts`: representa o vínculo entre o usuário do
  SuperTokens e a conta da aplicação.
- `src/auth/account-context.ts`: valida o payload antes de entregá-lo ao
  controller.
- `src/auth/guards/auth.guard.ts`: adapta `verifySession` ao ciclo de guards
  do NestJS.
- `src/auth/decorators/current-account.decorator.ts`: entrega o contexto
  validado ao controller.
- `src/auth/auth.controller.ts`: expõe `GET /me`.
- `src/create-app.ts`: registra CORS, `middleware()` e `errorHandler()` do
  SuperTokens, além do filtro global do NestJS.
- `src/auth/supertokens-exception.filter.ts`: trata erros SuperTokens que
  chegam ao pipeline de exceções do NestJS.

## Decisões

### `userContext` para identificar o signin

O flag `teapts.signInContext` é colocado somente no `signInPOST`. O
`createNewSession` usa o mesmo contexto para adicionar dados de conta apenas
ao login. Signup, refresh e outros fluxos não recebem o contexto de login.

### Conta órfã bloqueia a sessão

Uma identidade do SuperTokens sem registro correspondente em `accounts` não
é uma conta válida da aplicação. Por isso, a sessão não é criada e o backend
retorna erro 500 genérico sem incluir stack trace ou detalhes de infraestrutura
na resposta.

### Não existe endpoint de login próprio

O projeto usa `POST /auth/signin` fornecido pelo recipe EmailPassword. Isso
mantém as validações, cookies, refresh, signout e contratos do SDK oficial em
um único fluxo, evitando duplicação de regras de autenticação no NestJS.
