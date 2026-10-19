// Este módulo reúne a rota e a consulta de pacientes autorizados.

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from '../accounts/entities/account.entity';
import { Patient } from './entities/patient.entity';
import { PatientsController } from './controllers/patients.controller';
import { PatientsRepository } from './repositories/patients.repository';
import { PatientsService } from './services/patients.service';

@Module({
  imports: [TypeOrmModule.forFeature([Account, Patient])],
  controllers: [PatientsController],
  providers: [PatientsRepository, PatientsService],
})
export class PatientsModule {}
