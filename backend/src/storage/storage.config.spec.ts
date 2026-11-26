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
    'STORAGE_CLEANUP_INTERVAL_MINUTES',
    'STORAGE_UNCONFIRMED_TTL_MINUTES',
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
      cleanupIntervalMinutes: 60,
      unconfirmedTtlMinutes: 1440,
      baseUrl: 'http://localhost:3000',
    });
  });

  it('reads the expiry from the environment', () => {
    expect(
      configFrom({ ...validEnv, STORAGE_UPLOAD_URL_TTL_MINUTES: '30' })
        .uploadUrlTtlMinutes,
    ).toBe(30);
  });

  it('throws when API_DOMAIN is missing', () => {
    const env = { ...validEnv };
    delete env.API_DOMAIN;

    expect(() => configFrom(env)).toThrow('API_DOMAIN');
  });

  it.each([undefined, '', '   '])(
    'generates a random secret when STORAGE_TOKEN_SECRET is %j',
    (value) => {
      const env: Record<string, string> = { API_DOMAIN: validEnv.API_DOMAIN };
      if (value !== undefined) env.STORAGE_TOKEN_SECRET = value;

      const first = configFrom(env).tokenSecret;
      const second = configFrom(env).tokenSecret;

      expect(first).toMatch(/^[0-9a-f]{64}$/);
      expect(second).not.toBe(first);
    },
  );

  it.each(['0', '-5', 'abc', '1.5'])('rejects %s as the expiry', (ttl) => {
    expect(() =>
      configFrom({ ...validEnv, STORAGE_UPLOAD_URL_TTL_MINUTES: ttl }),
    ).toThrow('STORAGE_UPLOAD_URL_TTL_MINUTES must be a positive integer');
  });

  it('reads the cleanup interval and the unconfirmed window from the environment', () => {
    const config = configFrom({
      ...validEnv,
      STORAGE_CLEANUP_INTERVAL_MINUTES: '30',
      STORAGE_UNCONFIRMED_TTL_MINUTES: '120',
    });

    expect(config.cleanupIntervalMinutes).toBe(30);
    expect(config.unconfirmedTtlMinutes).toBe(120);
  });

  it.each([
    'STORAGE_CLEANUP_INTERVAL_MINUTES',
    'STORAGE_UNCONFIRMED_TTL_MINUTES',
  ])('rejects an invalid %s', (name) => {
    for (const value of ['0', '-5', 'abc', '1.5']) {
      expect(() => configFrom({ ...validEnv, [name]: value })).toThrow(
        `${name} must be a positive integer`,
      );
    }
  });

  it.each(['15', '10'])(
    'rejects a window of %s minutes, not greater than the upload url expiry',
    (window) => {
      expect(() =>
        configFrom({ ...validEnv, STORAGE_UNCONFIRMED_TTL_MINUTES: window }),
      ).toThrow('STORAGE_UNCONFIRMED_TTL_MINUTES must be greater than');
    },
  );
});
