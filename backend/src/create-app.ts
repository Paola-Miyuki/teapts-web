// Este arquivo monta a aplicação NestJS usada pelo processo principal.
// Primeiro entram CORS e o middleware do SuperTokens.
// Depois o errorHandler oficial trata as rotas /auth/* e seus erros.
// O filtro global só atua quando um erro SuperTokens chega ao pipeline NestJS.

import { NestFactory } from '@nestjs/core';
import supertokens from 'supertokens-node';
import { errorHandler, middleware } from 'supertokens-node/framework/express';
import { AppModule } from './app.module';
import { SupertokensExceptionFilter } from './auth/supertokens-exception.filter';

/**
 * Cria a aplicação com a mesma cadeia de middleware usada em produção.
 *
 * A ordem importa: o middleware precisa criar as rotas do SuperTokens antes
 * de seu errorHandler. O tratamento principal de /auth/* ocorre nessa cadeia
 * Express; o filtro global cobre apenas erros encaminhados ao NestJS.
 *
 * @returns aplicação NestJS configurada
 * @throws erro de inicialização do NestJS ou do SuperTokens
 */
export async function createApp() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [process.env.WEBSITE_DOMAIN ?? 'http://localhost:3001'],
    allowedHeaders: ['content-type', ...supertokens.getAllCORSHeaders()],
    exposedHeaders: [...supertokens.getAllCORSHeaders()],
    credentials: true,
  });

  app.use(middleware());
  app.use(errorHandler());
  app.useGlobalFilters(new SupertokensExceptionFilter());

  return app;
}
