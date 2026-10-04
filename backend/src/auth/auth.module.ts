// Este arquivo registra as rotas e serviços de autenticação.
// AccountsModule fornece o serviço usado pelos overrides do SuperTokens.
// A injeção pelo NestJS evita criar AccountsService manualmente.
// O módulo não cria um endpoint paralelo de login.

import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { SupertokensService } from './supertokens.service';
import { AccountsModule } from '../accounts/accounts.module';

/**
 * Registra as rotas e serviços de autenticação e dá acesso ao serviço
 * responsável por consultar a conta vinculada ao usuário.
 *
 * @returns configuração do módulo de autenticação
 */
@Module({
  imports: [AccountsModule],
  controllers: [AuthController],
  providers: [SupertokensService],
})
export class AuthModule {}
