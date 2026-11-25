import { ConfigService } from '@nestjs/config';
import { getStorageConfig } from './storage.config';

const validEnv: Record<string, string> = {
  STORAGE_TOKEN_SECRET: 'secret',
  API_DOMAIN: 'http://localhost:3000/',
};

function configFrom(env: Record<string, string>) {
  return getStorageConfig(new ConfigService(env));
}

// O ConfigService lê process.env antes do config interno: as variáveis do
// storage são isoladas do ambiente real.
describe('getStorageConfig', () => {
  const keys = [
    'STORAGE_TOKEN_SECRET',
    'STORAGE_UPLOAD_URL_TTL_MINUTES',
    'API_DOMAIN',
  ];
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of keys) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of keys) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  });

  it('uses the default expiry of 15 minutes and trims the base URL', () => {
    expect(configFrom(validEnv)).toEqual({
      tokenSecret: 'secret',
      uploadUrlTtlMinutes: 15,
      baseUrl: 'http://localhost:3000',
    });
  });

  it('reads the expiry from the environment', () => {
    expect(
      configFrom({ ...validEnv, STORAGE_UPLOAD_URL_TTL_MINUTES: '30' })
        .uploadUrlTtlMinutes,
    ).toBe(30);
  });

  it.each(['STORAGE_TOKEN_SECRET', 'API_DOMAIN'])(
    'throws when %s is missing',
    (missing) => {
      const env = { ...validEnv };
      delete env[missing];

      expect(() => configFrom(env)).toThrow(missing);
    },
  );

  it('rejects a blank secret without exposing it', () => {
    expect(() =>
      configFrom({ ...validEnv, STORAGE_TOKEN_SECRET: '   ' }),
    ).toThrow('STORAGE_TOKEN_SECRET must not be empty');
  });

  it.each(['0', '-5', 'abc', '1.5'])('rejects %s as the expiry', (ttl) => {
    expect(() =>
      configFrom({ ...validEnv, STORAGE_UPLOAD_URL_TTL_MINUTES: ttl }),
    ).toThrow('STORAGE_UPLOAD_URL_TTL_MINUTES must be a positive integer');
  });
});
