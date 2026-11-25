/*
 * Apoio dos e2e de consulta de documentos (RFDOC003 e RFDOC007): sobe os
 * controllers de documentos e do storage com o AuthGuard real, o
 * ValidationPipe global e os services reais. O SuperTokens, o banco e o
 * repositório de documentos são dublês em memória; o storage usa o
 * PostgresStorage real sobre um repositório em memória.
 */
import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import type { Request, Response } from 'express';
import { createValidationPipe } from '../../src/common/validation/create-validation-pipe';

type SessionMiddleware = (
  request: Request,
  response: Response,
  next: (error?: unknown) => void,
) => Promise<void>;

// Sessão que o verifySession mockado anexa à requisição; sem ela, o
// AuthGuard responde 401 porque o payload da sessão é inválido.
let currentSession: Record<string, unknown> | undefined;

// Sob ESM os mocks de módulo não são içados: este arquivo registra o mock e só
// depois importa o código da aplicação, com import dinâmico.
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

export const patientId = '7c1f0f0e-1d2b-4b43-8a6e-0f2b6c1d9e11';
export const otherPatientId = '0a1b2c3d-1d2b-4b43-8a6e-0f2b6c1d9e22';
export const patientAccountId = 'patient-account';
export const teamAccountId = 'team-account';

export type DocumentRow = {
  id: string;
  patientId: string;
  title: string;
  category: string;
  fileKey: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByAccountId: string;
  deletedAt: Date | null;
};

export function documentRow(
  id: string,
  overrides: Partial<DocumentRow> = {},
): DocumentRow {
  return {
    id,
    patientId,
    title: 'Laudo',
    category: 'medical_report',
    fileKey: `${patientId}/${id}-laudo.pdf`,
    mimeType: 'application/pdf',
    sizeBytes: 13,
    uploadedByAccountId: teamAccountId,
    deletedAt: null,
    ...overrides,
  };
}

export function signIn(session: {
  accountId?: string;
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

export function signOut() {
  currentSession = undefined;
}

/** Caminho e query de uma URL absoluta, para o supertest. */
export function pathOf(url: string) {
  const { pathname, search } = new URL(url);

  return `${pathname}${search}`;
}

export type AppSetup = {
  documents: DocumentRow[];
  /** Objetos do storage, por `fileKey`. */
  objects: Map<string, Record<string, unknown>>;
  /** Vínculo do profissional com o paciente (`null`: sem vínculo). */
  findPatient: () => Promise<unknown>;
  /** Listagem do repositório (o SQL fica fora do e2e). */
  findPage: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
};

export async function createApp(setup: AppSetup): Promise<INestApplication> {
  const { DocumentsController } =
    await import('../../src/documents/controllers/documents.controller.js');
  const { MyDocumentsController } =
    await import('../../src/documents/controllers/my-documents.controller.js');
  const { PatientDocumentsController } =
    await import('../../src/documents/controllers/patient-documents.controller.js');
  const { StorageObjectsController } =
    await import('../../src/storage/controllers/storage-objects.controller.js');
  const { DocumentAccessService } =
    await import('../../src/documents/services/document-access.service.js');
  const { DocumentsService } =
    await import('../../src/documents/services/documents.service.js');
  const { DocumentTimelineService } =
    await import('../../src/documents/services/document-timeline.service.js');
  const { DocumentUploadService } =
    await import('../../src/documents/services/document-upload.service.js');
  const { DocumentsRepository } =
    await import('../../src/documents/repositories/documents.repository.js');
  const { PostgresStorage } =
    await import('../../src/storage/postgres-storage.js');
  const { StorageService } =
    await import('../../src/storage/storage.service.js');
  const { StorageTokenService } =
    await import('../../src/storage/services/storage-token.service.js');
  const { STORAGE_CONFIG } =
    await import('../../src/storage/storage.config.js');
  const { StoredObject } =
    await import('../../src/storage/entities/stored-object.entity.js');
  const { PatientsRepository } =
    await import('../../src/patients/repositories/patients.repository.js');
  const { AccountsService } =
    await import('../../src/accounts/services/accounts.service.js');
  const { AuthGuard } = await import('../../src/auth/guards/auth.guard.js');

  const objectsRepository = {
    findOne: async ({ where }: { where: { fileKey: string } }) =>
      setup.objects.get(where.fileKey) ?? null,
  };
  const documentsRepository = {
    findActiveById: async (id: string) =>
      setup.documents.find((d) => d.id === id && d.deletedAt === null) ?? null,
    findPage: setup.findPage,
  };

  const moduleRef = await Test.createTestingModule({
    controllers: [
      DocumentsController,
      MyDocumentsController,
      PatientDocumentsController,
      StorageObjectsController,
    ],
    providers: [
      AuthGuard,
      // O AuthGuard consulta a situação da conta (RFAUT005).
      { provide: AccountsService, useValue: { isActive: async () => true } },
      DocumentAccessService,
      DocumentsService,
      DocumentUploadService,
      StorageTokenService,
      { provide: DocumentsRepository, useValue: documentsRepository },
      { provide: DocumentTimelineService, useValue: {} },
      {
        provide: STORAGE_CONFIG,
        useValue: {
          tokenSecret: 'secret',
          uploadUrlTtlMinutes: 15,
          baseUrl: 'http://localhost:3000',
        },
      },
      { provide: StorageService, useClass: PostgresStorage },
      {
        provide: PatientsRepository,
        useValue: {
          patientExists: async (id: string) =>
            id === patientId || id === otherPatientId,
          findPatient: setup.findPatient,
        },
      },
      { provide: getDataSourceToken(), useValue: {} },
      {
        provide: getRepositoryToken(StoredObject),
        useValue: objectsRepository,
      },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useLogger(false);
  app.useGlobalPipes(createValidationPipe());
  await app.init();

  return app;
}
