import { jest } from '@jest/globals';
import { type EntityManager, QueryFailedError, type Repository } from 'typeorm';
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
    findOne: jest.fn<(options: unknown) => Promise<unknown>>(),
    update: jest.fn<(criteria: unknown, values: unknown) => Promise<unknown>>(),
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

    const { url, expiresAt } = storage.createUploadUrl(
      fileKey,
      'application/pdf',
      now,
    );

    expect(expiresAt).toEqual(new Date('2026-12-01T12:15:00.000Z'));

    const parsed = new URL(url);

    expect(`${parsed.origin}${parsed.pathname}`).toBe(
      `http://localhost:3000/storage/objects/${encodeURIComponent(fileKey)}`,
    );
    const token = parsed.searchParams.get('token')!;
    const mimeType = 'application/pdf';

    expect(tokens.verify(token, fileKey, 'write', { now, mimeType })).toBe(
      true,
    );
    expect(
      tokens.verify(token, fileKey, 'write', { now: expiresAt, mimeType }),
    ).toBe(false);
    expect(
      tokens.verify(token, fileKey, 'write', { now, mimeType: 'image/png' }),
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

describe('PostgresStorage.headObject', () => {
  it('returns the type and size stored with the object', async () => {
    const { objects, storage } = createStorage();
    objects.findOne.mockResolvedValue({
      fileKey,
      mimeType: 'application/pdf',
      sizeBytes: 1024,
    });

    await expect(storage.headObject(fileKey)).resolves.toEqual({
      mimeType: 'application/pdf',
      sizeBytes: 1024,
    });
    expect(objects.findOne).toHaveBeenCalledWith({
      where: { fileKey },
      select: { fileKey: true, mimeType: true, sizeBytes: true },
    });
  });

  it('returns null when the object does not exist', async () => {
    const { objects, storage } = createStorage();
    objects.findOne.mockResolvedValue(null);

    await expect(storage.headObject(fileKey)).resolves.toBeNull();
  });
});

describe('PostgresStorage.activateObject', () => {
  it('marks the object as active', async () => {
    const { objects, storage } = createStorage();
    objects.update.mockResolvedValue({});

    await storage.activateObject(fileKey);

    expect(objects.update).toHaveBeenCalledWith({ fileKey }, { active: true });
  });

  it('uses the repository of the transaction manager when given', async () => {
    const { objects, storage } = createStorage();
    const transactional = { update: jest.fn() };
    const manager = {
      getRepository: jest.fn(() => transactional),
    } as unknown as EntityManager;

    await storage.activateObject(fileKey, manager);

    expect(transactional.update).toHaveBeenCalledWith(
      { fileKey },
      { active: true },
    );
    expect(objects.update).not.toHaveBeenCalled();
  });
});

describe('PostgresStorage.createReadUrl', () => {
  it('points at the backend with a read token limited to the object, valid for 5 minutes', () => {
    const { storage, tokens } = createStorage();
    const now = new Date('2026-12-01T12:00:00.000Z');

    const { url, expiresAt } = storage.createReadUrl(fileKey, now);

    expect(expiresAt).toEqual(new Date('2026-12-01T12:05:00.000Z'));

    const parsed = new URL(url);
    const token = parsed.searchParams.get('token') ?? '';

    expect(parsed.origin).toBe('http://localhost:3000');
    expect(decodeURIComponent(parsed.pathname)).toBe(
      `/storage/objects/${fileKey}`,
    );
    expect(tokens.verify(token, fileKey, 'read', { now })).toBe(true);
    expect(tokens.verify(token, fileKey, 'write', { now })).toBe(false);
    expect(tokens.verify(token, 'patient-1/other.pdf', 'read', { now })).toBe(
      false,
    );
    expect(tokens.verify(token, fileKey, 'read', { now: expiresAt })).toBe(
      false,
    );
  });
});

describe('PostgresStorage.getObject', () => {
  it('returns the type, size and content of the object', async () => {
    const { objects, storage } = createStorage();
    const content = Buffer.from('conteudo');
    objects.findOne.mockResolvedValue({
      fileKey,
      mimeType: 'application/pdf',
      sizeBytes: 8,
      content,
    });

    await expect(storage.getObject(fileKey)).resolves.toEqual({
      mimeType: 'application/pdf',
      sizeBytes: 8,
      content,
    });
    expect(objects.findOne).toHaveBeenCalledWith({
      where: { fileKey },
      select: {
        fileKey: true,
        mimeType: true,
        sizeBytes: true,
        content: true,
      },
    });
  });

  it('returns null when the object does not exist', async () => {
    const { objects, storage } = createStorage();
    objects.findOne.mockResolvedValue(null);

    await expect(storage.getObject(fileKey)).resolves.toBeNull();
  });
});
