// Este arquivo agrupa a entidade e o serviço de contas.
// O módulo raiz registra o acesso ao banco por TypeORM.
// O módulo de autenticação importa este módulo para montar o contexto do login.
// Exportar AccountsService mantém a consulta dentro do container do NestJS.

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from './account.entity';
import { AccountsService } from './accounts.service';

/**
 * Agrupa a entidade e as operações de contas para que outros módulos,
 * especialmente o módulo de autenticação, possam reutilizá-las.
 *
 * @returns configuração do módulo de contas
 */
@Module({
  imports: [TypeOrmModule.forFeature([Account])],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
