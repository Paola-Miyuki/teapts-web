import { jest } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { MAX_FILE_SIZE_BYTES } from '../file-policy';
import { StorageTokenService } from '../services/storage-token.service';
import {
  type PutObjectInput,
  StorageObjectAlreadyExistsError,
  StorageService,
  type StoredObjectContent,
} from '../storage.service';
import { StorageObjectsController } from './storage-objects.controller';

const fileKey = 'patient-1/abc-laudo.pdf';
const tokens = new StorageTokenService({
  tokenSecret: 'secret',
  uploadUrlTtlMinutes: 15,
  baseUrl: 'http://localhost:3000',
});

function token(options: { expired?: boolean; key?: string } = {}) {
  const expiresAt = new Date(Date.now() + (options.expired ? -1000 : 60_000));

  return tokens.sign(options.key ?? fileKey, 'write', expiresAt, {
    mimeType: 'application/pdf',
  });
}

describe('PUT /storage/objects/:fileKey', () => {
  let app: INestApplication;
  let storage: {
    putObject: jest.Mock<(input: PutObjectInput) => Promise<void>>;
  };

  beforeEach(async () => {
    storage = { putObject: jest.fn(async () => undefined) };

    const moduleRef = await Test.createTestingModule({
      controllers: [StorageObjectsController],
      providers: [
        { provide: StorageTokenService, useValue: tokens },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useLogger(false);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const put = (t: string | undefined, contentType = 'application/pdf') => {
    const req = request(app.getHttpServer()).put(
      `/storage/objects/${encodeURIComponent(fileKey)}${t ? `?token=${t}` : ''}`,
    );

    return req.set('Content-Type', contentType);
  };

  it('stores the body and answers 204', async () => {
    const response = await put(token()).send(Buffer.from('conteudo'));

    expect(response.status).toBe(204);
    expect(storage.putObject).toHaveBeenCalledWith({
      fileKey,
      mimeType: 'application/pdf',
      content: Buffer.from('conteudo'),
    });
  });

  it.each([
    ['without a token', undefined],
    ['with an expired token', token({ expired: true })],
    ['with a token for another object', token({ key: 'patient-1/other.pdf' })],
    ['with a forged token', 'abc.def'],
  ])('answers 403 UPLOAD_URL_INVALID %s', async (_name, t) => {
    const response = await put(t).send(Buffer.from('conteudo'));

    expect(response.status).toBe(403);
    expect(response.body.status).toBe('UPLOAD_URL_INVALID');
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('answers 403 when the Content-Type differs from the one the URL was signed for', async () => {
    const response = await put(token(), 'image/png').send(
      Buffer.from('conteudo'),
    );

    expect(response.status).toBe(403);
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('answers 400 FILE_TOO_LARGE above 5 MB', async () => {
    const response = await put(token()).send(
      Buffer.alloc(MAX_FILE_SIZE_BYTES + 1),
    );

    expect(response.status).toBe(400);
    expect(response.body.status).toBe('FILE_TOO_LARGE');
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('accepts a file of exactly 5 MB', async () => {
    const response = await put(token()).send(Buffer.alloc(MAX_FILE_SIZE_BYTES));

    expect(response.status).toBe(204);
  });

  it('answers 400 for an empty file', async () => {
    const response = await put(token()).send(Buffer.alloc(0));

    expect(response.status).toBe(400);
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it('answers 409 FILE_ALREADY_UPLOADED when the object already exists', async () => {
    storage.putObject.mockRejectedValue(
      new StorageObjectAlreadyExistsError(fileKey),
    );

    const response = await put(token()).send(Buffer.from('conteudo'));

    expect(response.status).toBe(409);
    expect(response.body.status).toBe('FILE_ALREADY_UPLOADED');
  });
});

describe('GET /storage/objects/:fileKey', () => {
  let app: INestApplication;
  let storage: {
    getObject: jest.Mock<(key: string) => Promise<StoredObjectContent | null>>;
  };

  const readToken = (options: { expired?: boolean; key?: string } = {}) =>
    tokens.sign(
      options.key ?? fileKey,
      'read',
      new Date(Date.now() + (options.expired ? -1000 : 60_000)),
    );

  beforeEach(async () => {
    storage = {
      getObject: jest.fn(async () => ({
        mimeType: 'application/pdf',
        sizeBytes: 8,
        content: Buffer.from('conteudo'),
      })),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [StorageObjectsController],
      providers: [
        { provide: StorageTokenService, useValue: tokens },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useLogger(false);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const get = (query: string) =>
    request(app.getHttpServer()).get(
      `/storage/objects/${encodeURIComponent(fileKey)}${query}`,
    );

  it('serves the content with the stored type and an inline disposition', async () => {
    const response = await get(`?token=${readToken()}`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.headers['content-disposition']).toBe(
      "inline; filename*=UTF-8''abc-laudo.pdf",
    );
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.body.toString()).toBe('conteudo');
    expect(storage.getObject).toHaveBeenCalledWith(fileKey);
  });

  it('forces the download with download=1', async () => {
    const response = await get(`?token=${readToken()}&download=1`);

    expect(response.headers['content-disposition']).toBe(
      "attachment; filename*=UTF-8''abc-laudo.pdf",
    );
  });

  it.each([
    ['without a token', ''],
    ['with an expired token', `?token=${readToken({ expired: true })}`],
    [
      'with a token for another object',
      `?token=${readToken({ key: 'patient-1/other.pdf' })}`,
    ],
    ['with a write token', `?token=${token()}`],
    ['with a forged token', '?token=abc.def'],
  ])('answers 403 READ_URL_INVALID %s', async (_name, query) => {
    const response = await get(query);

    expect(response.status).toBe(403);
    expect(response.body.status).toBe('READ_URL_INVALID');
    expect(storage.getObject).not.toHaveBeenCalled();
  });

  it('answers 404 FILE_NOT_FOUND when the object does not exist', async () => {
    storage.getObject.mockResolvedValue(null);

    const response = await get(`?token=${readToken()}`);

    expect(response.status).toBe(404);
    expect(response.body.status).toBe('FILE_NOT_FOUND');
  });
});
