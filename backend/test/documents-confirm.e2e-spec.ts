/*
 * Este teste cobre a confirmação do documento (RFDOC002) pelo HTTP: o
 * POST /patients/:id/documents depois do envio pela uploadUrl, com o AuthGuard
 * real, o ValidationPipe global e os services reais. O SuperTokens e o banco
 * são trocados por dublês em memória; o storage usa o PostgresStorage real.
 */
import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
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
let DocumentTimelineService: (typeof import('../src/documents/services/document-timeline.service.js'))['DocumentTimelineService'];
let DocumentsRepository: (typeof import('../src/documents/repositories/documents.repository.js'))['DocumentsRepository'];
let DocumentEntity: (typeof import('../src/documents/entities/document.entity.js'))['DocumentEntity'];
let TimelineRecorderService: (typeof import('../src/timeline/services/timeline-recorder.service.js'))['TimelineRecorderService'];
let PtsEntity: (typeof import('../src/pts/entities/pts.entity.js'))['PtsEntity'];
let Professional: (typeof import('../src/professionals/entities/professional.entity.js'))['Professional'];
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
  ({ DocumentTimelineService } =
    await import('../src/documents/services/document-timeline.service.js'));
  ({ DocumentsRepository } =
    await import('../src/documents/repositories/documents.repository.js'));
  ({ DocumentEntity } =
    await import('../src/documents/entities/document.entity.js'));
  ({ TimelineRecorderService } =
    await import('../src/timeline/services/timeline-recorder.service.js'));
  ({ PtsEntity } = await import('../src/pts/entities/pts.entity.js'));
  ({ Professional } =
    await import('../src/professionals/entities/professional.entity.js'));
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

function uniqueViolation(table: string) {
  return new QueryFailedError(
    `INSERT INTO "${table}"`,
    [],
    Object.assign(new Error('duplicate key'), { code: '23505' }),
  );
}

describe('document confirmation (e2e)', () => {
  const patientId = '7c1f0f0e-1d2b-4b43-8a6e-0f2b6c1d9e11';
  const otherPatientId = '0a1b2c3d-1d2b-4b43-8a6e-0f2b6c1d9e22';
  const professionalAccountId = '4e3d2c1b-0a9f-4e8d-9c7b-6a5f4e3d2c1b';
  const metadata = {
    title: 'Laudo neurológico',
    category: 'medical_report',
    issueDate: '2026-11-20',
    issuerName: 'Dra. Marta Reis, CRM-PR 12345',
  };

  let app: INestApplication;
  let objects: Map<string, Record<string, unknown>>;
  let documents: Array<Record<string, unknown>>;
  let events: Array<Record<string, unknown>>;
  let activePts: { id: string } | null;
  let patientsRepository: {
    patientExists: jest.Mock<(id: string) => Promise<boolean>>;
    findPatient: jest.Mock<(scope: unknown, id: string) => Promise<unknown>>;
  };

  function signIn(session: {
    role: 'admin' | 'user';
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

  function pathOf(uploadUrl: string) {
    const { pathname, search } = new URL(uploadUrl);

    return `${pathname}${search}`;
  }

  // Pede a URL, envia o arquivo e devolve a chave do objeto gravado.
  async function upload(forPatient = patientId) {
    const created = await request(app.getHttpServer())
      .post(`/patients/${forPatient}/documents/upload-url`)
      .send({
        fileName: 'laudo.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 13,
      });

    await request(app.getHttpServer())
      .put(pathOf(created.body.uploadUrl))
      .set('Content-Type', 'application/pdf')
      .send(Buffer.from('%PDF-conteudo'));

    return created.body.fileKey as string;
  }

  function confirm(fileKey: string, overrides: object = {}, id = patientId) {
    return request(app.getHttpServer())
      .post(`/patients/${id}/documents`)
      .send({ fileKey, ...metadata, ...overrides });
  }

  beforeEach(async () => {
    objects = new Map();
    documents = [];
    events = [];
    activePts = { id: 'pts-1' };
    patientsRepository = {
      patientExists: jest.fn(async () => true),
      findPatient: jest.fn(async () => ({ read_only: false })),
    };

    const objectsRepository = {
      insert: jest.fn(async (values: { fileKey: string }) => {
        if (objects.has(values.fileKey)) {
          throw uniqueViolation('stored_object');
        }

        objects.set(values.fileKey, { ...values });
      }),
      findOne: jest.fn(async ({ where }: { where: { fileKey: string } }) => {
        return objects.get(where.fileKey) ?? null;
      }),
      update: jest.fn(async (where: { fileKey: string }, values: object) => {
        Object.assign(objects.get(where.fileKey) ?? {}, values);
      }),
    };
    const documentsRepository = {
      create: (data: object) => ({ ...data }),
      save: jest.fn(async (data: Record<string, unknown>) => {
        if (documents.some((row) => row.fileKey === data.fileKey)) {
          throw uniqueViolation('document');
        }

        const row = {
          id: `doc-${documents.length + 1}`,
          createdAt: new Date('2026-12-01T12:00:00.000Z'),
          ...data,
        };
        documents.push(row);

        return row;
      }),
      findOne: jest.fn(
        async ({ where }: { where: { fileKey: string } }) =>
          documents.find((row) => row.fileKey === where.fileKey) ?? null,
      ),
    };
    const repositories = new Map<unknown, unknown>([
      [DocumentEntity, documentsRepository],
      [StoredObject, objectsRepository],
      [
        Professional,
        {
          exists: async ({ where }: { where: { accountId: string } }) =>
            where.accountId === professionalAccountId,
        },
      ],
    ]);
    const manager = {
      getRepository: (entity: unknown) => repositories.get(entity),
      findOne: jest.fn(async (entity: unknown) =>
        entity === PtsEntity ? activePts : null,
      ),
    };
    const dataSource = {
      getRepository: manager.getRepository,
      transaction: async (work: (manager: unknown) => Promise<unknown>) =>
        work(manager),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [PatientDocumentsController, StorageObjectsController],
      providers: [
        AuthGuard,
        // O AuthGuard consulta a situação da conta (RFAUT005).
        { provide: AccountsService, useValue: { isActive: async () => true } },
        DocumentAccessService,
        DocumentUploadService,
        DocumentsService,
        DocumentTimelineService,
        DocumentsRepository,
        StorageTokenService,
        {
          provide: TimelineRecorderService,
          useValue: {
            record: async (event: Record<string, unknown>) => {
              events.push(event);
            },
          },
        },
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
        { provide: getDataSourceToken(), useValue: dataSource },
        {
          provide: getRepositoryToken(StoredObject),
          useValue: objectsRepository,
        },
        {
          provide: getRepositoryToken(DocumentEntity),
          useValue: documentsRepository,
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

  it('creates a single document, activates the object and records the event', async () => {
    signIn({ role: 'user', professionalProfileIds: ['professional-1'] });
    const fileKey = await upload();

    expect(objects.get(fileKey)).toMatchObject({ active: false });

    const response = await confirm(fileKey);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: 'doc-1',
      title: 'Laudo neurológico',
      category: 'medical_report',
      mimeType: 'application/pdf',
      sizeBytes: 13,
      createdAt: '2026-12-01T12:00:00.000Z',
    });
    expect(documents).toHaveLength(1);
    expect(documents[0]).toMatchObject({
      patientId,
      fileKey,
      uploadedByAccountId: 'account-1',
      issuerName: 'Dra. Marta Reis, CRM-PR 12345',
      issueDate: '2026-11-20',
    });
    expect(objects.get(fileKey)).toMatchObject({ active: true });
    expect(events).toEqual([
      expect.objectContaining({
        ptsId: 'pts-1',
        type: 'document_uploaded',
        targetType: 'document',
        targetId: 'doc-1',
        authorProfessionalId: 'professional-1',
        executedByAccountId: 'account-1',
      }),
    ]);
  });

  it('does not duplicate the document nor the event when the file key repeats', async () => {
    signIn({ role: 'admin' });
    const fileKey = await upload();

    const first = await confirm(fileKey);
    const second = await confirm(fileKey);

    expect(second.status).toBe(201);
    expect(second.body).toEqual(first.body);
    expect(documents).toHaveLength(1);
    expect(events).toHaveLength(1);
  });

  it('confirms without an event when the patient has no active PTS', async () => {
    signIn({ role: 'admin' });
    activePts = null;
    const fileKey = await upload();

    const response = await confirm(fileKey);

    expect(response.status).toBe(201);
    expect(documents).toHaveLength(1);
    expect(events).toHaveLength(0);
  });

  it('accepts a professional account as the issuer', async () => {
    signIn({ role: 'admin' });
    const fileKey = await upload();

    const response = await confirm(fileKey, {
      issuerName: undefined,
      issuerAccountId: professionalAccountId,
    });

    expect(response.status).toBe(201);
    expect(documents[0]).toMatchObject({
      issuerAccountId: professionalAccountId,
      issuerName: null,
    });
  });

  it('answers 400 VALIDATION_ERROR when the issuer account is not a professional', async () => {
    signIn({ role: 'admin' });
    const fileKey = await upload();

    const response = await confirm(fileKey, {
      issuerName: undefined,
      issuerAccountId: '9f9f9f9f-0a9f-4e8d-9c7b-6a5f4e3d2c1b',
    });

    expect(response.status).toBe(400);
    expect(response.body.status).toBe('VALIDATION_ERROR');
    expect(documents).toHaveLength(0);
  });

  it('answers 400 UPLOAD_NOT_FOUND when nothing was uploaded for the key', async () => {
    signIn({ role: 'admin' });

    const response = await confirm(`${patientId}/never-uploaded.pdf`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 'UPLOAD_NOT_FOUND',
      message: 'O arquivo não foi encontrado no storage. Envie-o novamente.',
    });
    expect(documents).toHaveLength(0);
  });

  it('answers 400 UPLOAD_NOT_FOUND for a key that is not from the patient', async () => {
    signIn({ role: 'admin' });
    const fileKey = await upload(otherPatientId);

    const response = await confirm(fileKey);

    expect(response.status).toBe(400);
    expect(response.body.status).toBe('UPLOAD_NOT_FOUND');
    expect(objects.get(fileKey)).toMatchObject({ active: false });
  });

  it('answers 403 when a confirmed key is used for another patient', async () => {
    signIn({ role: 'admin' });
    const fileKey = await upload();
    await confirm(fileKey);

    const response = await confirm(fileKey, {}, otherPatientId);

    expect(response.status).toBe(403);
    expect(documents).toHaveLength(1);
  });

  it('answers 403 FORBIDDEN for a professional without a bond', async () => {
    signIn({ role: 'user', professionalProfileIds: ['professional-1'] });
    const fileKey = await upload();
    patientsRepository.findPatient.mockResolvedValue(null);

    const response = await confirm(fileKey);

    expect(response.status).toBe(403);
    expect(response.body.status).toBe('FORBIDDEN');
    expect(documents).toHaveLength(0);
    expect(objects.get(fileKey)).toMatchObject({ active: false });
  });

  it('answers 404 PATIENT_NOT_FOUND for an unknown patient', async () => {
    signIn({ role: 'admin' });
    patientsRepository.patientExists.mockResolvedValue(false);

    const response = await confirm(`${patientId}/abc.pdf`);

    expect(response.status).toBe(404);
    expect(response.body.status).toBe('PATIENT_NOT_FOUND');
  });

  it('answers 401 without a session', async () => {
    const response = await confirm(`${patientId}/abc.pdf`);

    expect(response.status).toBe(401);
  });

  it('answers 400 VALIDATION_ERROR without a title', async () => {
    signIn({ role: 'admin' });

    const response = await confirm(`${patientId}/abc.pdf`, { title: '' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 'VALIDATION_ERROR',
      message: 'Informe o título.',
    });
  });
});
