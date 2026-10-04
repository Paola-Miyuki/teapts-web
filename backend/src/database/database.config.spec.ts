import { ConfigService } from '@nestjs/config';
import { getDatabaseOptions } from './database.config';
import { Account } from './entities/account.entity';
import { CreateAccount1791072000000 } from './migrations/1791072000000-CreateAccount';

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
      entities: [Account],
      migrations: [CreateAccount1791072000000],
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
