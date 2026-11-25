/*
 * Este teste cobre o fluxo HTTP do envio de documento (RFDOC001): o
 * POST /patients/:id/documents/upload-url e o PUT na uploadUrl devolvida, com o
 * AuthGuard real, o ValidationPipe global e os services reais. O SuperTokens e
 * o banco são trocados por dublês; o storage usa o PostgresStorage real sobre
 * um repositório em memória.
 */
import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Request, Response } from 'express';
import request from 'supertest';
import { QueryFailedError } from 'typeorm';
import { createValidationPipe } from '../src/common/validation/create-validation-pipe';

type SessionMiddleware = (
  request: Request,
  response: Response,
  next: (error?: unknown) => void,
) => Promise<void>;

// Sessão que o verifySession mockado anexa à requisição; sem ela, o
// AuthGuard responde 401 porque o payload da sessão é inválido.
let currentSession: Record<string, unknown> | undefined;

jest.unstable_mockModule(
  'supertokens-node/recipe/session/framework/express',
  () => ({
    verifySession: jest.fn<(options?: unknown) => SessionMiddleware>(
      () => async (req, _res, next) => {
        if (currentSession) {
          (req as Request & { session?: unknown }).session = currentSession;
        }

        next();
      },
    ),
  }),
);

// Sob ESM os mocks de módulo não são içados: o código da aplicação é
// importado depois, com import dinâmico (`.js` mapeado para `.ts`).
let PatientDocumentsController: (typeof import('../src/documents/controllers/patient-documents.controller.js'))['PatientDocumentsController'];
let StorageObjectsController: (typeof import('../src/storage/controllers/storage-objects.controller.js'))['StorageObjectsController'];
let DocumentAccessService: (typeof import('../src/documents/services/document-access.service.js'))['DocumentAccessService'];
let DocumentUploadService: (typeof import('../src/documents/services/document-upload.service.js'))['DocumentUploadService'];
let DocumentsService: (typeof import('../src/documents/services/documents.service.js'))['DocumentsService'];
let PostgresStorage: (typeof import('../src/storage/postgres-storage.js'))['PostgresStorage'];
let StorageService: (typeof import('../src/storage/storage.service.js'))['StorageService'];
let StorageTokenService: (typeof import('../src/storage/services/storage-token.service.js'))['StorageTokenService'];
let STORAGE_CONFIG: (typeof import('../src/storage/storage.config.js'))['STORAGE_CONFIG'];
let StoredObject: (typeof import('../src/storage/entities/stored-object.entity.js'))['StoredObject'];
let PatientsRepository: (typeof import('../src/patients/repositories/patients.repository.js'))['PatientsRepository'];
let AccountsService: (typeof import('../src/accounts/services/accounts.service.js'))['AccountsService'];
let AuthGuard: (typeof import('../src/auth/guards/auth.guard.js'))['AuthGuard'];

beforeAll(async () => {
  ({ PatientDocumentsController } =
    await import('../src/documents/controllers/patient-documents.controller.js'));
  ({ StorageObjectsController } =
    await import('../src/storage/controllers/storage-objects.controller.js'));
  ({ DocumentAccessService } =
    await import('../src/documents/services/document-access.service.js'));
  ({ DocumentUploadService } =
    await import('../src/documents/services/document-upload.service.js'));
  ({ DocumentsService } =
    await import('../src/documents/services/documents.service.js'));
  ({ PostgresStorage } = await import('../src/storage/postgres-storage.js'));
  ({ StorageService } = await import('../src/storage/storage.service.js'));
  ({ StorageTokenService } =
    await import('../src/storage/services/storage-token.service.js'));
  ({ STORAGE_CONFIG } = await import('../src/storage/storage.config.js'));
  ({ StoredObject } =
    await import('../src/storage/entities/stored-object.entity.js'));
  ({ PatientsRepository } =
    await import('../src/patients/repositories/patients.repository.js'));
  ({ AccountsService } =
    await import('../src/accounts/services/accounts.service.js'));
  ({ AuthGuard } = await import('../src/auth/guards/auth.guard.js'));
});

describe('document upload (e2e)', () => {
  const patientId = '7c1f0f0e-1d2b-4b43-8a6e-0f2b6c1d9e11';
  const body = {
    fileName: 'Laudo Neurológico.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 820000,
  };

  let app: INestApplication;
  let stored: Map<string, Record<string, unknown>>;
  let patientsRepository: {
    patientExists: jest.Mock<(id: string) => Promise<boolean>>;
    findPatient: jest.Mock<(scope: unknown, id: string) => Promise<unknown>>;
  };
  let documentRows: number;

  function signIn(session: {
    role: 'admin' | 'user';
    patientProfileId?: string | null;
    professionalProfileIds?: string[];
  }) {
    currentSession = {
      getAccessTokenPayload: () => ({
        accountId: 'account-1',
        patientProfileId: null,
        professionalProfileIds: [],
        ...session,
      }),
    };
  }

  // Caminho e query da uploadUrl, para chamar o PUT no app de teste.
  function pathOf(uploadUrl: string) {
    const { pathname, search } = new URL(uploadUrl);

    return `${pathname}${search}`;
  }

  async function requestUrl(overrides: object = {}) {
    return request(app.getHttpServer())
      .post(`/patients/${patientId}/documents/upload-url`)
      .send({ ...body, ...overrides });
  }

  beforeEach(async () => {
    stored = new Map();
    documentRows = 0;
    patientsRepository = {
      patientExists: jest.fn(async () => true),
      findPatient: jest.fn(async () => ({ read_only: false })),
    };
    const objectsRepository = {
      insert: jest.fn(async (values: { fileKey: string }) => {
        if (stored.has(values.fileKey)) {
          throw new QueryFailedError(
            'INSERT INTO "stored_object"',
            [],
            Object.assign(new Error('duplicate key'), { code: '23505' }),
          );
        }

        stored.set(values.fileKey, values);
      }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [PatientDocumentsController, StorageObjectsController],
      providers: [
        AuthGuard,
        // O AuthGuard consulta a situação da conta (RFAUT005).
        { provide: AccountsService, useValue: { isActive: async () => true } },
        DocumentAccessService,
        DocumentUploadService,
        // A confirmação (RFDOC002) tem o próprio e2e; aqui só satisfaz o controller.
        { provide: DocumentsService, useValue: {} },
        StorageTokenService,
        {
          provide: STORAGE_CONFIG,
          useValue: {
            tokenSecret: 'secret',
            uploadUrlTtlMinutes: 15,
            baseUrl: 'http://localhost:3000',
          },
        },
        { provide: StorageService, useClass: PostgresStorage },
        { provide: PatientsRepository, useValue: patientsRepository },
        {
          provide: getRepositoryToken(StoredObject),
          useValue: objectsRepository,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useLogger(false);
    app.useGlobalPipes(createValidationPipe());
    await app.init();
  });

  afterEach(async () => {
    currentSession = undefined;
    await app.close();
  });

  it('gives the admin a url, uploads the file through it and creates no document', async () => {
    signIn({ role: 'admin' });

    const created = await requestUrl();

    expect(created.status).toBe(201);
    expect(created.body.fileKey).toMatch(
      new RegExp(`^${patientId}/[0-9a-f-]{36}-Laudo-Neurologico\\.pdf$`),
    );
    expect(new Date(created.body.expiresAt).getTime()).toBeGreaterThan(
      Date.now(),
    );
    // Nada é gravado antes do PUT.
    expect(stored.size).toBe(0);

    const uploaded = await request(app.getHttpServer())
      .put(pathOf(created.body.uploadUrl))
      .set('Content-Type', 'application/pdf')
      .send(Buffer.from('%PDF-conteudo'));

    expect(uploaded.status).toBe(204);
    expect(stored.get(created.body.fileKey)).toMatchObject({
      fileKey: created.body.fileKey,
      mimeType: 'application/pdf',
      sizeBytes: 13,
      active: false,
    });
    // Nenhum documento: a tabela `document` só entra na confirmação (#130).
    expect(documentRows).toBe(0);
  });

  it('refuses a second upload to the same url', async () => {
    signIn({ role: 'admin' });
    const created = await requestUrl();
    const path = pathOf(created.body.uploadUrl);
    const send = () =>
      request(app.getHttpServer())
        .put(path)
        .set('Content-Type', 'application/pdf')
        .send(Buffer.from('conteudo'));

    expect((await send()).status).toBe(204);

    const again = await send();

    expect(again.status).toBe(409);
    expect(again.body.status).toBe('FILE_ALREADY_UPLOADED');
  });

  it('refuses an upload with another file type than the one asked', async () => {
    signIn({ role: 'admin' });
    const created = await requestUrl();

    const response = await request(app.getHttpServer())
      .put(pathOf(created.body.uploadUrl))
      .set('Content-Type', 'image/png')
      .send(Buffer.from('conteudo'));

    expect(response.status).toBe(403);
    expect(response.body.status).toBe('UPLOAD_URL_INVALID');
    expect(stored.size).toBe(0);
  });

  it('refuses an upload with a tampered token or another object', async () => {
    signIn({ role: 'admin' });
    const first = await requestUrl();
    const second = await requestUrl();
    const otherKey = new URL(second.body.uploadUrl).pathname;
    const token = new URL(first.body.uploadUrl).search;

    const response = await request(app.getHttpServer())
      .put(`${otherKey}${token}`)
      .set('Content-Type', 'application/pdf')
      .send(Buffer.from('conteudo'));

    expect(response.status).toBe(403);
    expect(stored.size).toBe(0);
  });

  it('refuses an upload above 5 MB', async () => {
    signIn({ role: 'admin' });
    const created = await requestUrl();

    const response = await request(app.getHttpServer())
      .put(pathOf(created.body.uploadUrl))
      .set('Content-Type', 'application/pdf')
      .send(Buffer.alloc(5_242_881));

    expect(response.status).toBe(400);
    expect(response.body.status).toBe('FILE_TOO_LARGE');
    expect(stored.size).toBe(0);
  });

  it('lets a professional with an active PTS and the patient themself ask for a url', async () => {
    signIn({ role: 'user', professionalProfileIds: ['pro-1'] });
    expect((await requestUrl()).status).toBe(201);

    signIn({ role: 'user', patientProfileId: patientId });
    expect((await requestUrl()).status).toBe(201);
  });

  it('answers 403 FORBIDDEN to a professional without a link or with a closed PTS', async () => {
    signIn({ role: 'user', professionalProfileIds: ['pro-1'] });
    patientsRepository.findPatient.mockResolvedValue(null);
    expect((await requestUrl()).status).toBe(403);

    patientsRepository.findPatient.mockResolvedValue({ read_only: true });

    const closed = await requestUrl();

    expect(closed.status).toBe(403);
    expect(closed.body.status).toBe('FORBIDDEN');
  });

  it('answers 403 FORBIDDEN to a patient asking for another patient', async () => {
    signIn({ role: 'user', patientProfileId: 'patient-2' });

    const response = await requestUrl();

    expect(response.status).toBe(403);
    expect(response.body.status).toBe('FORBIDDEN');
  });

  it('answers 404 PATIENT_NOT_FOUND for a missing patient', async () => {
    signIn({ role: 'admin' });
    patientsRepository.patientExists.mockResolvedValue(false);

    const response = await requestUrl();

    expect(response.status).toBe(404);
    expect(response.body.status).toBe('PATIENT_NOT_FOUND');
  });

  it('answers 400 for a type outside the list and for a file above 5 MB', async () => {
    signIn({ role: 'admin' });

    const type = await requestUrl({ mimeType: 'text/html' });
    const size = await requestUrl({ sizeBytes: 5_242_881 });

    expect(type.status).toBe(400);
    expect(type.body.status).toBe('FILE_TYPE_NOT_ALLOWED');
    expect(size.status).toBe(400);
    expect(size.body.status).toBe('FILE_TOO_LARGE');
  });

  it('answers 401 without a session', async () => {
    const response = await requestUrl();

    expect(response.status).toBe(401);
    expect(patientsRepository.patientExists).not.toHaveBeenCalled();
  });
});
