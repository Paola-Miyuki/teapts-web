// Este módulo reúne a rota e a consulta de profissionais.
// O repository usa as entidades existentes, sem criar schema novo.

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from '../accounts/entities/account.entity';
import { Professional } from './entities/professional.entity';
import { ProfessionalsController } from './controllers/professionals.controller';
import { ProfessionalsRepository } from './repositories/professionals.repository';
import { ProfessionalsService } from './services/professionals.service';

/**
 * Registra os componentes responsáveis pela consulta de profissionais.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Account, Professional])],
  controllers: [ProfessionalsController],
  providers: [ProfessionalsRepository, ProfessionalsService],
})
export class ProfessionalsModule {}
