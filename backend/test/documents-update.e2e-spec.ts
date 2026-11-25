import { jest } from '@jest/globals';
import { ExecutionContext, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import type { EntityManager } from 'typeorm';
import { AccountRole } from '../src/accounts/enums/account-role.enum';
import type { AccountContext } from '../src/accounts/services/accounts.service';
import { AuthGuard } from '../src/auth/guards/auth.guard';
import { createValidationPipe } from '../src/common/validation/create-validation-pipe';
import { PatientDocumentsController } from '../src/documents/controllers/patient-documents.controller';
import { DocumentEntity } from '../src/documents/entities/document.entity';
import { DocumentCategory } from '../src/documents/enums/document-category.enum';
import { DocumentsRepository } from '../src/documents/repositories/documents.repository';
import { DocumentAccessService } from '../src/documents/services/document-access.service';
import { DocumentTimelineService } from '../src/documents/services/document-timeline.service';
import { DocumentUploadService } from '../src/documents/services/document-upload.service';
import { DocumentsService } from '../src/documents/services/documents.service';
import { PatientsRepository } from '../src/patients/repositories/patients.repository';
import { PtsEntity } from '../src/pts/entities/pts.entity';
import { StorageService } from '../src/storage/storage.service';
import { TimelineRecorderService } from '../src/timeline/services/timeline-recorder.service';

describe('document metadata update (e2e)', () => {
  const patientId = '7c1f0f0e-1d2b-4b43-8a6e-0f2b6c1d9e11';
  const documentId = '4e3d2c1b-0a9f-4e8d-9c7b-6a5f4e3d2c1b';
  let account: AccountContext = {
    accountId: 'admin-account',
    role: AccountRole.Admin,
    patientProfileId: null,
    professionalProfileIds: [],
  };
  let app: INestApplication;
  let row: DocumentEntity;
  let events: Record<string, unknown>[];

  beforeEach(async () => {
    account = {
      accountId: 'admin-account',
      role: AccountRole.Admin,
      patientProfileId: null,
      professionalProfileIds: [],
    };
    row = {
      id: documentId,
      patientId,
      title: 'Laudo neurológico',
      description: 'Avaliação inicial.',
      category: DocumentCategory.MEDICAL_REPORT,
      issueDate: null,
      issuerAccountId: null,
      issuerName: null,
      fileKey: `${patientId}/original.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: 123,
      uploadedByAccountId: 'uploader',
      replacesDocumentId: null,
      createdAt: new Date('2026-12-01T12:00:00.000Z'),
      updatedAt: null,
      updatedByAccountId: null,
      deletedAt: null,
      deletedByAccountId: null,
    };
    events = [];

    const repository = {
      findOne: jest.fn(async ({ where }: { where: { id?: string } }) =>
        where.id === row.id && row.deletedAt === null ? row : null,
      ),
      find: jest.fn(async () => [row]),
      save: jest.fn(async (document: DocumentEntity) => {
        row = document;
        return row;
      }),
    };
    const manager = {
      getRepository: () => repository,
      findOne: async (entity: unknown) =>
        entity === PtsEntity ? { id: 'pts-active' } : null,
    };
    const dataSource = {
      transaction: async (
        work: (transactionManager: EntityManager) => Promise<unknown>,
      ) => work(manager as unknown as EntityManager),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [PatientDocumentsController],
      providers: [
        DocumentAccessService,
        DocumentTimelineService,
        DocumentsRepository,
        DocumentsService,
        { provide: DocumentUploadService, useValue: {} },
        { provide: StorageService, useValue: {} },
        {
          provide: PatientsRepository,
          useValue: {
            patientExists: async () => true,
            findPatient: async () => null,
          },
        },
        {
          provide: TimelineRecorderService,
          useValue: {
            record: async (event: Record<string, unknown>) => {
              events.push(event);
            },
          },
        },
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: getRepositoryToken(DocumentEntity), useValue: repository },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context
            .switchToHttp()
            .getRequest<{ accountContext?: AccountContext }>().accountContext =
            account;
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useLogger(false);
    app.useGlobalPipes(createValidationPipe());
    await app.init();
  });

  afterEach(async () => app.close());

  it('updates metadata only and records document_updated', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/documents/${documentId}`)
      .send({
        title: 'Laudo neurológico (2026)',
        description: 'Avaliação de novembro.',
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: documentId,
      title: 'Laudo neurológico (2026)',
      description: 'Avaliação de novembro.',
      updatedAt: expect.any(String),
    });
    expect(row.fileKey).toBe(`${patientId}/original.pdf`);
    expect(row.updatedByAccountId).toBe(account.accountId);
    expect(events).toEqual([
      expect.objectContaining({
        ptsId: 'pts-active',
        type: 'document_updated',
        targetId: documentId,
        targetType: 'document',
        executedByAccountId: account.accountId,
      }),
    ]);
  });

  it('does not expose deleted documents', async () => {
    row.deletedAt = new Date();

    const response = await request(app.getHttpServer())
      .patch(`/documents/${documentId}`)
      .send({ title: 'Novo título' });

    expect(response.status).toBe(404);
    expect(response.body.status).toBe('DOCUMENT_NOT_FOUND');
    expect(events).toHaveLength(0);
  });

  it('forbids a professional without a patient bond', async () => {
    account = {
      accountId: 'professional-account',
      role: AccountRole.User,
      patientProfileId: null,
      professionalProfileIds: ['professional-profile'],
    };

    const response = await request(app.getHttpServer())
      .patch(`/documents/${documentId}`)
      .send({ title: 'Novo título' });

    expect(response.status).toBe(403);
    expect(response.body.status).toBe('FORBIDDEN');
    expect(events).toHaveLength(0);
  });
});
