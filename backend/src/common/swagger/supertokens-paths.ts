// Este arquivo descreve à mão as rotas do SDK do SuperTokens usadas pelo
// frontend. Elas vêm do middleware Express, não de controllers do Nest, e
// por isso não aparecem sozinhas no documento.
// Se uma atualização do supertokens-node mudar esses contratos, este arquivo
// precisa ser revisto: nada aqui acompanha o SDK automaticamente.
// O /auth/signout fica de fora: está desligado (ver POST /auth/logout).

import type {
  OperationObject,
  ParameterObject,
  PathsObject,
  SchemaObject,
} from '@nestjs/swagger';

/** Nome do esquema de segurança do refresh token no modo header. */
export const REFRESH_SECURITY_NAME = 'refresh';

const ridHeader: ParameterObject = {
  name: 'rid',
  in: 'header',
  required: true,
  description: 'Receita do SuperTokens que atende a rota.',
  schema: { type: 'string', enum: ['emailpassword'] },
};

const authModeHeader: ParameterObject = {
  name: 'st-auth-mode',
  in: 'header',
  required: false,
  description:
    '`cookie`: tokens em cookies `HttpOnly` (navegador). `header`: tokens nos headers de resposta `st-access-token` e `st-refresh-token`, enviados de volta em `Authorization: Bearer <token>`.',
  schema: { type: 'string', enum: ['cookie', 'header'] },
};

/** Corpo `formFields` do EmailPassword com os campos aceitos. */
function formFieldsBody(
  fields: string[],
  example: Array<{ id: string; value: string }>,
): OperationObject['requestBody'] {
  const schema: SchemaObject = {
    type: 'object',
    required: ['formFields'],
    properties: {
      formFields: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'value'],
          properties: {
            id: { type: 'string', enum: fields },
            value: { type: 'string' },
          },
        },
      },
    },
  };

  return {
    required: true,
    content: {
      'application/json': { schema, example: { formFields: example } },
    },
  };
}

/** Corpo de resposta do EmailPassword: `status` diz se deu certo. */
function emailPasswordResponse(
  statuses: string[],
  examples: Record<string, { value: unknown }>,
): OperationObject['responses'] {
  return {
    '200': {
      description:
        'O SDK responde 200 também nos erros de negócio; o resultado está em `status`. Com `OK`, a sessão é criada (cookies ou headers, conforme `st-auth-mode`).',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['status'],
            properties: {
              status: { type: 'string', enum: statuses },
              user: {
                type: 'object',
                description: 'Usuário do SuperTokens (só com `OK`).',
              },
              formFields: {
                type: 'array',
                description: 'Campos inválidos (só com `FIELD_ERROR`).',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    error: { type: 'string' },
                  },
                },
              },
            },
          },
          examples,
        },
      },
    },
    '500': {
      description:
        'Conta órfã (usuário no SuperTokens sem linha em `account`) ou Core inacessível. Nenhuma sessão é emitida.',
    },
  };
}

const fieldErrorExample = {
  value: {
    status: 'FIELD_ERROR',
    formFields: [{ id: 'name', error: 'Informe o nome' }],
  },
};

/** Rotas do SDK do SuperTokens acrescentadas ao documento do Nest. */
export const supertokensPaths: PathsObject = {
  '/auth/signup': {
    post: {
      tags: ['auth'],
      summary: 'Cadastra uma conta (SDK do SuperTokens)',
      description:
        'Cria a identidade no SuperTokens e a linha em `account` (role `user`). A senha precisa de pelo menos 8 caracteres, com letra e número; o `name` não pode ser vazio.',
      parameters: [ridHeader, authModeHeader],
      requestBody: formFieldsBody(
        ['email', 'password', 'name'],
        [
          { id: 'email', value: 'maria@teapts.local' },
          { id: 'password', value: 'Senha123' },
          { id: 'name', value: 'Maria' },
        ],
      ),
      responses: emailPasswordResponse(
        ['OK', 'FIELD_ERROR', 'EMAIL_ALREADY_EXISTS_ERROR'],
        {
          ok: { value: { status: 'OK', user: {} } },
          fieldError: fieldErrorExample,
          emailExists: { value: { status: 'EMAIL_ALREADY_EXISTS_ERROR' } },
        },
      ),
    },
  },
  '/auth/signin': {
    post: {
      tags: ['auth'],
      summary: 'Faz login (SDK do SuperTokens)',
      description:
        'Valida e-mail e senha e cria a sessão com `accountId`, `role` e os perfis no access token.',
      parameters: [ridHeader, authModeHeader],
      requestBody: formFieldsBody(
        ['email', 'password'],
        [
          { id: 'email', value: 'teste@teapts.local' },
          { id: 'password', value: 'teapts123' },
        ],
      ),
      responses: emailPasswordResponse(
        ['OK', 'WRONG_CREDENTIALS_ERROR', 'FIELD_ERROR'],
        {
          ok: { value: { status: 'OK', user: {} } },
          wrongCredentials: { value: { status: 'WRONG_CREDENTIALS_ERROR' } },
          fieldError: {
            value: {
              status: 'FIELD_ERROR',
              formFields: [{ id: 'email', error: 'Email is invalid' }],
            },
          },
        },
      ),
    },
  },
  '/auth/session/refresh': {
    post: {
      tags: ['auth'],
      summary: 'Renova a sessão (SDK do SuperTokens)',
      description:
        'Gera um access token novo. No modo cookie, usa o cookie `sRefreshToken`; no modo header, o refresh token vai em `Authorization: Bearer <refresh token>` (esquema `refresh`) e os tokens novos voltam em `st-access-token` e `st-refresh-token`.',
      parameters: [authModeHeader],
      security: [{ [REFRESH_SECURITY_NAME]: [] }],
      responses: {
        '200': {
          description: 'Tokens renovados.',
          content: {
            'application/json': {
              schema: { type: 'object' },
              example: {},
            },
          },
        },
        '401': {
          description:
            'Refresh token ausente, inválido ou revogado (por exemplo, depois do logout).',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UnauthorizedResponseDto' },
            },
          },
        },
      },
    },
  },
};
