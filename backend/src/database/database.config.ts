import { ConfigService } from '@nestjs/config';
import { DataSourceOptions } from 'typeorm';
import { ActivityEntity as Activity } from '../activities/entities/activity.entity';
import { ActivityDocumentEntity as ActivityDocument } from '../activities/entities/activity-document.entity';
import { Account } from '../accounts/entities/account.entity';
import { Medication } from '../patients/entities/medication.entity';
import { Patient } from '../patients/entities/patient.entity';
import { SupportContact } from '../patients/entities/support-contact.entity';
import { DocumentEntity as Document } from '../documents/entities/document.entity';
import { StoredObject } from '../storage/entities/stored-object.entity';
import { Professional } from '../professionals/entities/professional.entity';
import { PtsEntity as Pts } from '../pts/entities/pts.entity';
import { PtsGoalEntity as PtsGoal } from '../pts/entities/pts-goal.entity';
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
import { AddAccountStatus1791149000000 } from './migrations/1791149000000-AddAccountStatus';
import { AddPtsSheetColumns1791149010000 } from './migrations/1791149010000-AddPtsSheetColumns';
import { AddProfessionalRegistrationFields1791149020000 } from './migrations/1791149020000-AddProfessionalRegistrationFields';
import { AddPtsVersion1791149100000 } from './migrations/1791149100000-AddPtsVersion';
import { AddPtsClosingColumns1791149080000 } from './migrations/1791149080000-AddPtsClosingColumns';
import { CreateActivity1791149070000 } from './migrations/1791149070000-CreateActivity';
import { CreateNotification1791149060000 } from './migrations/1791149060000-CreateNotification';
import { AddPatientProfileFields1791149090000 } from './migrations/1791149090000-AddPatientProfileFields';
import { NotificationEntity as Notification } from '../notifications/entities/notification.entity';
import { CreateStoredObject1791149030000 } from './migrations/1791149030000-CreateStoredObject';
import { CreatePtsGoal1791149040000 } from './migrations/1791149040000-CreatePtsGoal';
import { CreateDocument1791149050000 } from './migrations/1791149050000-CreateDocument';

// Entidades e migrations sao listadas explicitamente: glob com __dirname nao
// funciona sob ESM (testes) nem depois do build. Toda entidade/migration nova
// precisa ser registrada aqui.
const entities = [
  Account,
  Activity,
  ActivityDocument,
  Medication,
  Notification,
  Patient,
  SupportContact,
  Professional,
  Pts,
  PtsGoal,
  TimelineRecord,
  StoredObject,
  Document,
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
  AddAccountStatus1791149000000,
  AddPtsSheetColumns1791149010000,
  AddProfessionalRegistrationFields1791149020000,
  CreateStoredObject1791149030000,
  CreatePtsGoal1791149040000,
  CreateDocument1791149050000,
  CreateNotification1791149060000,
  CreateActivity1791149070000,
  AddPtsClosingColumns1791149080000,
  AddPatientProfileFields1791149090000,
  AddPtsVersion1791149100000,
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
