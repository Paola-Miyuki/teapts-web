import { jest } from '@jest/globals';
import { QueryFailedError, type Repository } from 'typeorm';
import { PostgresStorage } from './postgres-storage';
import { StorageTokenService } from './services/storage-token.service';
import { StorageObjectAlreadyExistsError } from './storage.service';
import type { StoredObject } from './entities/stored-object.entity';

const config = {
  tokenSecret: 'secret',
  uploadUrlTtlMinutes: 15,
  baseUrl: 'http://localhost:3000',
};
const fileKey = 'patient-1/abc-laudo escolar.pdf';

function createStorage() {
  const objects = {
    insert: jest.fn<(values: unknown) => Promise<unknown>>(),
  };
  const tokens = new StorageTokenService(config);
  const storage = new PostgresStorage(
    objects as unknown as Repository<StoredObject>,
    tokens,
    config,
  );

  return { objects, tokens, storage };
}

describe('PostgresStorage.createUploadUrl', () => {
  it('points at the backend, limited to the object, and expires in the configured time', () => {
    const { storage, tokens } = createStorage();
    const now = new Date('2026-12-01T12:00:00.000Z');

    const { url, expiresAt } = storage.createUploadUrl(fileKey, now);

    expect(expiresAt).toEqual(new Date('2026-12-01T12:15:00.000Z'));

    const parsed = new URL(url);

    expect(`${parsed.origin}${parsed.pathname}`).toBe(
      `http://localhost:3000/storage/objects/${encodeURIComponent(fileKey)}`,
    );
    expect(
      tokens.verify(parsed.searchParams.get('token')!, fileKey, 'write', now),
    ).toBe(true);
    expect(
      tokens.verify(
        parsed.searchParams.get('token')!,
        fileKey,
        'write',
        expiresAt,
      ),
    ).toBe(false);
  });
});

describe('PostgresStorage.putObject', () => {
  const content = Buffer.from('conteudo');

  it('saves the object inactive, with the size of the content', async () => {
    const { objects, storage } = createStorage();
    objects.insert.mockResolvedValue({});

    await storage.putObject({ fileKey, mimeType: 'application/pdf', content });

    expect(objects.insert).toHaveBeenCalledWith({
      fileKey,
      mimeType: 'application/pdf',
      sizeBytes: content.length,
      content,
      active: false,
    });
  });

  it('refuses a key that already exists', async () => {
    const { objects, storage } = createStorage();
    objects.insert.mockRejectedValue(
      new QueryFailedError(
        'INSERT INTO "stored_object"',
        [],
        Object.assign(new Error('duplicate key'), { code: '23505' }),
      ),
    );

    await expect(
      storage.putObject({ fileKey, mimeType: 'application/pdf', content }),
    ).rejects.toBeInstanceOf(StorageObjectAlreadyExistsError);
  });

  it('propagates other database errors', async () => {
    const { objects, storage } = createStorage();
    const failure = new Error('connection lost');
    objects.insert.mockRejectedValue(failure);

    await expect(
      storage.putObject({ fileKey, mimeType: 'application/pdf', content }),
    ).rejects.toBe(failure);
  });
});
