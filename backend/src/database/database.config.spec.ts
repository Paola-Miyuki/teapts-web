import { ConfigService } from '@nestjs/config';
import { getDatabaseOptions } from './database.config';
import { Account } from '../accounts/entities/account.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Medication } from '../patients/entities/medication.entity';
import { Professional } from '../professionals/entities/professional.entity';
import { CreateAccount1791072000000 } from './migrations/1791072000000-CreateAccount';
import { LinkAccountToSupertokens1791148800000 } from './migrations/1791148800000-LinkAccountToSupertokens';
import { CreatePatientAndProfessional1791148860000 } from './migrations/1791148860000-CreatePatientAndProfessional';
import { PtsEntity as Pts } from '../pts/entities/pts.entity';
import { CreatePtsTables1791148870000 } from './migrations/1791148870000-CreatePtsTables';
import { AddProfessionalAccountSpecialismUnique1791148880000 } from './migrations/1791148880000-AddProfessionalAccountSpecialismUnique';
import { TimelineRecordEntity as TimelineRecord } from '../timeline/entities/timeline-record.entity';
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
import { StoredObject } from '../storage/entities/stored-object.entity';
import { CreateNotification1791149060000 } from './migrations/1791149060000-CreateNotification';
import { NotificationEntity as Notification } from '../notifications/entities/notification.entity';
import { CreateStoredObject1791149030000 } from './migrations/1791149030000-CreateStoredObject';
import { DocumentEntity as Document } from '../documents/entities/document.entity';
import { CreatePtsGoal1791149040000 } from './migrations/1791149040000-CreatePtsGoal';
import { CreateDocument1791149050000 } from './migrations/1791149050000-CreateDocument';
import { PtsGoalEntity as PtsGoal } from '../pts/entities/pts-goal.entity';
import { CreateActivity1791149070000 } from './migrations/1791149070000-CreateActivity';
import { ActivityEntity as Activity } from '../activities/entities/activity.entity';
import { ActivityDocumentEntity as ActivityDocument } from '../activities/entities/activity-document.entity';
import { AddPtsClosingColumns1791149080000 } from './migrations/1791149080000-AddPtsClosingColumns';
import { SupportContact } from '../patients/entities/support-contact.entity';

const DATABASE_KEYS = [
  'DATABASE_HOST',
  'DATABASE_PORT',
  'DATABASE_USER',
  'DATABASE_PASSWORD',
  'DATABASE_NAME',
] as const;

const validEnv: Record<string, string> = {
  DATABASE_HOST: 'localhost',
  DATABASE_PORT: '5432',
  DATABASE_USER: 'teapts',
  DATABASE_PASSWORD: 'secret',
  DATABASE_NAME: 'teapts',
};

function optionsFrom(env: Record<string, string>) {
  return getDatabaseOptions(new ConfigService(env));
}

// ConfigService le process.env antes do config interno, entao o ambiente real
// (Docker, CI, .env exportado no shell) e isolado para os casos de erro.
describe('getDatabaseOptions', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of DATABASE_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of DATABASE_KEYS) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
  });

  it('maps the environment onto the postgres connection options', () => {
    expect(optionsFrom(validEnv)).toMatchObject({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'teapts',
      password: 'secret',
      database: 'teapts',
    });
  });

  it('never enables synchronize, so the schema only changes via migrations', () => {
    expect(optionsFrom(validEnv)).toMatchObject({ synchronize: false });
  });

  it('registers the entities and migrations explicitly', () => {
    expect(optionsFrom(validEnv)).toMatchObject({
      entities: [
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
      ],
      migrations: [
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
      ],
    });
  });

  it.each(DATABASE_KEYS)('throws when %s is missing', (missing) => {
    const env = { ...validEnv };
    delete env[missing];

    expect(() => optionsFrom(env)).toThrow(missing);
  });

  it.each(['0', '65536', 'not-a-port', '5432.5'])(
    'rejects %s as a port',
    (port) => {
      expect(() => optionsFrom({ ...validEnv, DATABASE_PORT: port })).toThrow(
        'DATABASE_PORT must be a valid TCP port',
      );
    },
  );
});
