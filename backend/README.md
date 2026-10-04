# Backend TEA-PTS

API NestJS responsável pelas rotas da aplicação, autenticação com
SuperTokens e resolução do contexto de contas armazenado em PostgreSQL.

## Estrutura principal

```text
src/
├── accounts/
│   ├── account.entity.ts
│   ├── accounts.module.ts
│   └── accounts.service.ts
├── auth/
│   ├── auth.controller.ts
│   ├── auth.module.ts
│   ├── account-context.ts
│   ├── guards/
│   ├── decorators/
│   ├── supertokens.service.ts
│   └── supertokens-exception.filter.ts
├── app.module.ts
├── create-app.ts
└── main.ts
```

`accounts` vincula o `userId` do SuperTokens ao registro de negócio usado
pela API. `auth` configura os overrides, a validação da sessão e a rota
protegida `/me`.

## Variáveis de ambiente

Copie o exemplo e ajuste os valores:

```bash
cp .env.example .env
```

Variáveis usadas pelo backend:

```env
PORT=3000
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_USER=teapts
DATABASE_PASSWORD=teapts
DATABASE_NAME=teapts
WEBSITE_DOMAIN=http://localhost:3001
API_DOMAIN=http://localhost:3000
SUPERTOKENS_CONNECTION_URI=http://localhost:3567
SUPERTOKENS_API_KEY=
NODE_ENV=development
```

## Subir com Docker Compose

Na raiz do repositório:

```bash
docker compose up -d --build
docker compose ps
```

O backend fica disponível em `http://localhost:3000`. PostgreSQL,
SuperTokens e frontend são iniciados pelo mesmo Compose.

## Executar localmente

Com PostgreSQL e SuperTokens disponíveis:

```bash
npm install
npm run start:dev
```

## Testes e validações

```bash
npm run build
npm run lint
npm test
npm run test:e2e
```

Os testes e2e de autenticação usam mocks do Core do SuperTokens e do serviço
de contas; não precisam de PostgreSQL ou SuperTokens em execução.

## Rotas

As rotas `/auth/*` são fornecidas pelo SDK do SuperTokens:

| Método | Rota | Resultado principal |
|---|---|---|
| `POST` | `/auth/signup` | Cria usuário no SuperTokens |
| `POST` | `/auth/signin` | Cria sessão e retorna `OK` ou `WRONG_CREDENTIALS_ERROR` |
| `POST` | `/auth/session/refresh` | Renova a sessão |
| `POST` | `/auth/signout` | Encerra a sessão |
| `GET` | `/me` | Retorna os dados da conta autenticada |

O frontend deve usar `st-auth-mode: cookie` quando fizer chamadas HTTP
manuais. O SDK web do SuperTokens gerencia os cookies `HttpOnly`.

## Regra de conta órfã

O login só cria uma sessão depois de localizar um registro correspondente
em `accounts.supertokens_user_id`.

Se o usuário existir no SuperTokens, mas não existir em `accounts`, a
criação da sessão é bloqueada e a API retorna `500` com mensagem genérica.
Nenhum cookie de sessão deve ser emitido nesse caso.
