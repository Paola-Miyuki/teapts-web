// Este módulo reúne a rota e a consulta de profissionais.
// O repositório usa as entidades existentes, sem criar schema novo.

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from '../database/entities/account.entity';
import { Professional } from '../database/entities/professional.entity';
import { ProfessionalsController } from './professionals.controller';
import { ProfessionalsService } from './professionals.service';

/**
 * Registra os componentes responsáveis pela consulta de profissionais.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Account, Professional])],
  controllers: [ProfessionalsController],
  providers: [ProfessionalsService],
})
export class ProfessionalsModule {}
