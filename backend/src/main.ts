import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import supertokens from 'supertokens-node';
import { middleware, errorHandler } from 'supertokens-node/framework/express';
import { SupertokensService } from './auth/supertokens.service'; 

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: ['http://localhost:3001', 'http://localhost:3000'],
    credentials: true,
    allowedHeaders: ['content-type', ...supertokens.getAllCORSHeaders()],
  });

  app.get(SupertokensService);

  app.use(middleware());

  app.use(errorHandler());
  await app.listen(process.env.PORT || 3000);
  console.log('Backend NestJS/SuperTokens a rodar na porta 3000');
}

bootstrap();