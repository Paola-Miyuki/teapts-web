import { ConfigService } from '@nestjs/config';
import { DataSourceOptions } from 'typeorm';
import { Account } from '../accounts/entities/account.entity';
import { Medication } from '../patients/entities/medication.entity';
import { Patient } from '../patients/entities/patient.entity';
import { SupportContact } from '../patients/entities/support-contact.entity';
import { Professional } from '../professionals/entities/professional.entity';
import { PtsEntity as Pts } from '../pts/entities/pts.entity';
import { TimelineRecordEntity as TimelineRecord } from '../timeline/entities/timeline-record.entity';
import { CreateAccount1791072000000 } from './migrations/1791072000000-CreateAccount';
import { LinkAccountToSupertokens1791148800000 } from './migrations/1791148800000-LinkAccountToSupertokens';
import { CreatePatientAndProfessional1791148860000 } from './migrations/1791148860000-CreatePatientAndProfessional';
import { CreatePtsTables1791148870000 } from './migrations/1791148870000-CreatePtsTables';
import { AddProfessionalAccountSpecialismUnique1791148880000 } from './migrations/1791148880000-AddProfessionalAccountSpecialismUnique';
import { AddPatientListFields1791148910000 } from './migrations/1791148910000-AddPatientListFields';
import { StandardizeColumnNames1791148920000 } from './migrations/1791148920000-StandardizeColumnNames';
import { CreateSupportContact1791148930000 } from './migrations/1791148930000-CreateSupportContact';
import { AlignPatientAndProfessionalConstraints1791148940000 } from './migrations/1791148940000-AlignPatientAndProfessionalConstraints';
import { AddAccountPersonalFields1791148950000 } from './migrations/1791148950000-AddAccountPersonalFields';
import { AddProfessionalCouncilFields1791148960000 } from './migrations/1791148960000-AddProfessionalCouncilFields';
import { AddDeletedAtToPts1791148970000 } from './migrations/1791148970000-AddDeletedAtToPts';
import { CreateTimelineRecord1791148980000 } from './migrations/1791148980000-CreateTimelineRecord';
import { AddPatientClinicalDataAndMedication1791148990000 } from './migrations/1791148990000-AddPatientClinicalDataAndMedication';

// Entidades e migrations sao listadas explicitamente: glob com __dirname nao
// funciona sob ESM (testes) nem depois do build. Toda entidade/migration nova
// precisa ser registrada aqui.
const entities = [
  Account,
  Medication,
  Patient,
  SupportContact,
  Professional,
  Pts,
  TimelineRecord,
];
const migrations = [
  CreateAccount1791072000000,
  LinkAccountToSupertokens1791148800000,
  CreatePatientAndProfessional1791148860000,
  CreatePtsTables1791148870000,
  AddProfessionalAccountSpecialismUnique1791148880000,
  AddPatientListFields1791148910000,
  StandardizeColumnNames1791148920000,
  CreateSupportContact1791148930000,
  AlignPatientAndProfessionalConstraints1791148940000,
  AddAccountPersonalFields1791148950000,
  AddProfessionalCouncilFields1791148960000,
  AddDeletedAtToPts1791148970000,
  CreateTimelineRecord1791148980000,
  AddPatientClinicalDataAndMedication1791148990000,
];

export function getDatabaseOptions(
  configService: ConfigService,
): DataSourceOptions {
  const port = Number(configService.getOrThrow<string>('DATABASE_PORT'));

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DATABASE_PORT must be a valid TCP port');
  }

  return {
    type: 'postgres',
    host: configService.getOrThrow<string>('DATABASE_HOST'),
    port,
    username: configService.getOrThrow<string>('DATABASE_USER'),
    password: configService.getOrThrow<string>('DATABASE_PASSWORD'),
    database: configService.getOrThrow<string>('DATABASE_NAME'),
    uuidExtension: 'pgcrypto',
    entities,
    migrations,
    synchronize: false,
  };
}
