// Este módulo reúne a rota e a consulta de pacientes autorizados.

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsModule } from '../accounts/accounts.module';
import { Account } from '../accounts/entities/account.entity';
import { PatientsController } from './controllers/patients.controller';
import { Medication } from './entities/medication.entity';
import { Patient } from './entities/patient.entity';
import { PatientsRepository } from './repositories/patients.repository';
import { PatientsService } from './services/patients.service';

@Module({
  imports: [
    AccountsModule,
    TypeOrmModule.forFeature([Account, Patient, Medication]),
  ],
  controllers: [PatientsController],
  providers: [PatientsRepository, PatientsService],
})
export class PatientsModule {}
