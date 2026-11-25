import { jest } from '@jest/globals';
import {
  ExecutionContext,
  type INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import type { EntityManager } from 'typeorm';
import { AccountRole } from '../src/accounts/enums/account-role.enum';
import type { AccountContext } from '../src/accounts/services/accounts.service';
import { AdminGuard } from '../src/auth/guards/admin.guard';
import { AuthGuard } from '../src/auth/guards/auth.guard';
import { createValidationPipe } from '../src/common/validation/create-validation-pipe';
import { DocumentsController } from '../src/documents/controllers/documents.controller';
import { DocumentEntity } from '../src/documents/entities/document.entity';
import { DocumentCategory } from '../src/documents/enums/document-category.enum';
import { DocumentsRepository } from '../src/documents/repositories/documents.repository';
import { DocumentAccessService } from '../src/documents/services/document-access.service';
import { DocumentTimelineService } from '../src/documents/services/document-timeline.service';
import { DocumentsService } from '../src/documents/services/documents.service';
import { PatientsRepository } from '../src/patients/repositories/patients.repository';
import { PtsEntity } from '../src/pts/entities/pts.entity';
import { StorageService } from '../src/storage/storage.service';
import { TimelineRecorderService } from '../src/timeline/services/timeline-recorder.service';

describe('document delete (e2e)', () => {
  const patientId = '7c1f0f0e-1d2b-4b43-8a6e-0f2b6c1d9e11';
  const documentId = '4e3d2c1b-0a9f-4e8d-9c7b-6a5f4e3d2c1b';
  const admin: AccountContext = {
    accountId: 'admin-account',
    role: AccountRole.Admin,
    patientProfileId: null,
    professionalProfileIds: [],
  };
  let account: AccountContext;
  let authenticated: boolean;
  let app: INestApplication;
  let row: DocumentEntity;
  let events: Record<string, unknown>[];
  let storage: {
    createReadUrl: jest.Mock;
    putObject: jest.Mock;
    activateObject: jest.Mock;
  };

  beforeEach(async () => {
    account = admin;
    authenticated = true;
    row = {
      id: documentId,
      patientId,
      title: 'Laudo neurológico',
      description: null,
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
    storage = {
      createReadUrl: jest.fn(() => ({
        url: 'http://localhost:3000/storage/objects/k?token=t',
        expiresAt: new Date('2026-12-01T12:05:00.000Z'),
      })),
      putObject: jest.fn(),
      activateObject: jest.fn(),
    };

    const repository = {
      findOne: jest.fn(async ({ where }: { where: { id?: string } }) =>
        where.id === row.id && row.deletedAt === null ? row : null,
      ),
      update: jest.fn(
        async (
          where: { id: string },
          set: { deletedAt: Date; deletedByAccountId: string },
        ) => {
          if (where.id !== row.id || row.deletedAt !== null) {
            return { affected: 0 };
          }

          row = { ...row, ...set };
          return { affected: 1 };
        },
      ),
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
      controllers: [DocumentsController],
      providers: [
        AdminGuard,
        DocumentAccessService,
        DocumentTimelineService,
        DocumentsRepository,
        DocumentsService,
        { provide: StorageService, useFactory: () => storage },
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
          if (!authenticated) {
            throw new UnauthorizedException();
          }

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

  it('lets the admin delete: the record and the file are kept, the read url is denied', async () => {
    const response = await request(app.getHttpServer()).delete(
      `/documents/${documentId}`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: documentId,
      deletedAt: expect.any(String),
    });
    expect(row.deletedAt).toBeInstanceOf(Date);
    expect(row.deletedByAccountId).toBe(admin.accountId);
    expect(row.fileKey).toBe(`${patientId}/original.pdf`);
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(storage.activateObject).not.toHaveBeenCalled();

    const url = await request(app.getHttpServer()).get(
      `/documents/${documentId}/url`,
    );

    expect(url.status).toBe(404);
    expect(url.body.status).toBe('DOCUMENT_NOT_FOUND');
    expect(storage.createReadUrl).not.toHaveBeenCalled();
  });

  it('records document_deleted on the timeline', async () => {
    await request(app.getHttpServer()).delete(`/documents/${documentId}`);

    expect(events).toEqual([
      expect.objectContaining({
        ptsId: 'pts-active',
        type: 'document_deleted',
        targetId: documentId,
        targetType: 'document',
        authorProfessionalId: null,
        executedByAccountId: admin.accountId,
      }),
    ]);
  });

  it.each([
    [
      'a professional',
      {
        accountId: 'professional-account',
        role: AccountRole.User,
        patientProfileId: null,
        professionalProfileIds: ['professional-profile'],
      },
    ],
    [
      'a patient',
      {
        accountId: 'patient-account',
        role: AccountRole.User,
        patientProfileId: patientId,
        professionalProfileIds: [],
      },
    ],
  ])('forbids %s', async (_label, other) => {
    account = other;

    const response = await request(app.getHttpServer()).delete(
      `/documents/${documentId}`,
    );

    expect(response.status).toBe(403);
    expect(response.body.status).toBe('FORBIDDEN');
    expect(row.deletedAt).toBeNull();
    expect(events).toHaveLength(0);
  });

  it('rejects a request without a session', async () => {
    authenticated = false;

    const response = await request(app.getHttpServer()).delete(
      `/documents/${documentId}`,
    );

    expect(response.status).toBe(401);
    expect(row.deletedAt).toBeNull();
  });

  it('answers 404 for an unknown or already deleted document', async () => {
    const unknown = await request(app.getHttpServer()).delete(
      '/documents/11111111-1111-4111-8111-111111111111',
    );

    await request(app.getHttpServer()).delete(`/documents/${documentId}`);
    const again = await request(app.getHttpServer()).delete(
      `/documents/${documentId}`,
    );

    expect(unknown.status).toBe(404);
    expect(unknown.body.status).toBe('DOCUMENT_NOT_FOUND');
    expect(again.status).toBe(404);
    expect(again.body.status).toBe('DOCUMENT_NOT_FOUND');
    expect(events).toHaveLength(1);
  });
});
