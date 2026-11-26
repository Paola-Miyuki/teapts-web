import { StorageTokenService } from './storage-token.service';

const config = {
  tokenSecret: 'secret-a',
  uploadUrlTtlMinutes: 15,
  cleanupIntervalMinutes: 60,
  unconfirmedTtlMinutes: 1440,
  baseUrl: 'http://localhost:3000',
};
const fileKey = 'patient-1/abc-laudo.pdf';
const now = new Date('2026-12-01T12:00:00.000Z');
const later = new Date(now.getTime() + 15 * 60_000);

describe('StorageTokenService', () => {
  const service = new StorageTokenService(config);

  it('accepts a token for the same object and operation before it expires', () => {
    const token = service.sign(fileKey, 'write', later);

    expect(service.verify(token, fileKey, 'write', { now })).toBe(true);
  });

  it('rejects an expired token', () => {
    const token = service.sign(fileKey, 'write', later);

    expect(service.verify(token, fileKey, 'write', { now: later })).toBe(false);
  });

  it('rejects a token for another object', () => {
    const token = service.sign(fileKey, 'write', later);

    expect(service.verify(token, 'patient-1/other.pdf', 'write', { now })).toBe(
      false,
    );
  });

  it('rejects a token for another operation', () => {
    const token = service.sign(fileKey, 'read', later);

    expect(service.verify(token, fileKey, 'write', { now })).toBe(false);
  });

  it('rejects a token signed with another secret', () => {
    const token = new StorageTokenService({
      ...config,
      tokenSecret: 'secret-b',
    }).sign(fileKey, 'write', later);

    expect(service.verify(token, fileKey, 'write', { now })).toBe(false);
  });

  it('rejects a token with a tampered payload', () => {
    const [, signature] = service.sign(fileKey, 'write', later).split('.');
    const forged = Buffer.from(
      JSON.stringify({ k: fileKey, op: 'write', exp: later.getTime() + 1e9 }),
    ).toString('base64url');

    expect(
      service.verify(`${forged}.${signature}`, fileKey, 'write', {
        now,
      }),
    ).toBe(false);
  });

  it('limits the token to the file type it was signed for', () => {
    const token = service.sign(fileKey, 'write', later, {
      mimeType: 'application/pdf',
    });

    expect(
      service.verify(token, fileKey, 'write', {
        now,
        mimeType: 'application/pdf',
      }),
    ).toBe(true);
    expect(
      service.verify(token, fileKey, 'write', { now, mimeType: 'image/png' }),
    ).toBe(false);
    expect(service.verify(token, fileKey, 'write', { now })).toBe(false);
  });

  it.each(['', 'abc', 'a.b.c', '.', 'a.'])(
    'rejects the malformed token "%s"',
    (token) => {
      expect(service.verify(token, fileKey, 'write', { now })).toBe(false);
    },
  );
});
