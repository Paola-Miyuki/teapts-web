// Este módulo reúne a rota e a consulta de pacientes autorizados.

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from '../database/entities/account.entity';
import { Patient } from '../database/entities/patient.entity';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';

@Module({
  imports: [TypeOrmModule.forFeature([Account, Patient])],
  controllers: [PatientsController],
  providers: [PatientsService],
})
export class PatientsModule {}
