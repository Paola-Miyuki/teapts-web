# Integração do login no Frontend

Este guia mostra como integrar a tela `/login` do Next.js com a API da
TEA-PTS usando o SDK oficial do SuperTokens.

## 1. Instale o SDK no frontend

No diretório do projeto frontend, execute:

```bash
npm install supertokens-web-js
```

## 2. Como a sessão funciona

A sessão é gerenciada pelo SuperTokens através de cookies do tipo
`httpOnly`.

Em termos simples:

- o navegador recebe e armazena os cookies automaticamente;
- o SDK do SuperTokens usa esses cookies para manter o usuário autenticado;
- o frontend **não deve ler, copiar ou salvar esses cookies no
  `localStorage`**;
- não é necessário guardar access tokens manualmente no frontend.

Cookies `httpOnly` não devem ser acessados pelo JavaScript da aplicação. Essa
é uma proteção importante: o navegador e o SDK cuidam da sessão para você.

Durante o desenvolvimento, a API usa `http://localhost:3000` e o frontend
usa `http://localhost:3001`.

## 3. Inicialize o SuperTokens

Crie uma inicialização do SuperTokens no frontend. Por exemplo, em
`src/lib/supertokens.ts`:

```ts
import SuperTokens from 'supertokens-web-js';
import EmailPassword from 'supertokens-web-js/recipe/emailpassword';
import Session from 'supertokens-web-js/recipe/session';

SuperTokens.init({
  appInfo: {
    appName: 'TEA-PTS',
    apiDomain: 'http://localhost:3000',
    websiteDomain: 'http://localhost:3001',
    apiBasePath: '/auth',
    websiteBasePath: '/auth',
  },
  recipeList: [EmailPassword.init(), Session.init()],
});
```

Importe esse arquivo uma vez antes de usar o SDK, por exemplo no componente
ou módulo responsável pela autenticação.

## 4. Faça login usando o SDK

O SuperTokens disponibiliza a rota `POST /auth/signin` na API. O frontend
não deve chamar essa rota diretamente com `fetch` ou Axios como fluxo
principal. Use obrigatoriamente `EmailPassword.signIn`.

Exemplo de uma função de login:

```ts
import EmailPassword from 'supertokens-web-js/recipe/emailpassword';

async function signIn(email: string, password: string) {
  const response = await EmailPassword.signIn({
    formFields: [
      { id: 'email', value: email },
      { id: 'password', value: password },
    ],
  });

  // A rede pode retornar HTTP 200. O resultado do login
  // deve ser validado pelo campo response.status.
  if (response.status === 'OK') {
    // Login concluído. O SuperTokens já gerenciou a sessão.
    return;
  }

  if (response.status === 'WRONG_CREDENTIALS_ERROR') {
    // Mensagem exata obrigatória:
    setErrorMessage('E-mail ou senha inválidos.');
    return;
  }

  setErrorMessage('Não foi possível concluir a autenticação.');
}
```

No exemplo, `setErrorMessage` representa o estado de erro da tela de login.
Por exemplo, em um componente React:

```tsx
const [errorMessage, setErrorMessage] = useState('');
```

### Atenção ao status da resposta

O status HTTP da requisição não é suficiente para decidir se o login foi
aceito. A API do SuperTokens retorna **HTTP 200 no nível de rede**, e o
resultado real fica no campo `response.status`.

Por isso, sempre verifique:

- `OK`: login concluído;
- `WRONG_CREDENTIALS_ERROR`: mostre exatamente
  **`E-mail ou senha inválidos.`**;
- outros status: mostre uma mensagem genérica de erro.

Não informe ao usuário se o e-mail ou a senha foi o campo incorreto.

## 5. Consuma a rota protegida `GET /me`

A rota `GET /me` retorna os dados da conta atualmente autenticada:

```json
{
  "accountId": "account-uuid",
  "name": "Nome do usuário",
  "email": "usuario@exemplo.com",
  "patientProfileId": null,
  "professionalProfileIds": []
}
```

Para que o navegador envie os cookies `httpOnly`, é **obrigatório** incluir
as credenciais na requisição.

### Usando `fetch`

Use `credentials: 'include'`:

```ts
const response = await fetch('http://localhost:3000/me', {
  credentials: 'include',
});

if (response.ok) {
  const account = await response.json();
  console.log(account);
}
```

Sem `credentials: 'include'`, o navegador não enviará os cookies para a API
quando frontend e backend estiverem em origens diferentes.

### Usando Axios

Use `withCredentials: true`:

```ts
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000',
  withCredentials: true,
});

const { data: account } = await api.get('/me');
console.log(account);
```

Também é possível configurar a opção diretamente em uma requisição:

```ts
const { data: account } = await axios.get('http://localhost:3000/me', {
  withCredentials: true,
});
```

## 6. Quando o usuário não estiver autenticado

Se `GET /me` retornar `401 Unauthorized`, considere que o usuário está
deslogado e redirecione-o para `/login`.

Não envie tokens no corpo da requisição nem crie um header
`Authorization` manualmente para esse fluxo. A autenticação é feita pela
sessão do SuperTokens e pelos cookies gerenciados pelo navegador.
