import { ConfigService } from '@nestjs/config';
import { DataSourceOptions } from 'typeorm';
import { Account } from './entities/account.entity';
import { Patient } from './entities/patient.entity';
import { Professional } from './entities/professional.entity';
import { CreateAccount1791072000000 } from './migrations/1791072000000-CreateAccount';
import { LinkAccountToSupertokens1791148800000 } from './migrations/1791148800000-LinkAccountToSupertokens';
import { CreatePatientAndProfessional1791148860000 } from './migrations/1791148860000-CreatePatientAndProfessional';

// Entidades e migrations sao listadas explicitamente: glob com __dirname nao
// funciona sob ESM (testes) nem depois do build. Toda entidade/migration nova
// precisa ser registrada aqui.
const entities = [Account, Patient, Professional];
const migrations = [
  CreateAccount1791072000000,
  LinkAccountToSupertokens1791148800000,
  CreatePatientAndProfessional1791148860000,
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
