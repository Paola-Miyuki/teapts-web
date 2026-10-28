// Este módulo reúne a conta, o contexto da sessão e a listagem de contas.

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsController } from './controllers/accounts.controller';
import { Account } from './entities/account.entity';
import { AccountsRepository } from './repositories/accounts.repository';
import { AccountsService } from './services/accounts.service';

@Module({
  imports: [TypeOrmModule.forFeature([Account])],
  controllers: [AccountsController],
  providers: [AccountsRepository, AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
