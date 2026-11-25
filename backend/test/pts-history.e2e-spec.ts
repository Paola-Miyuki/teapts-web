/*
 * RFPTS009 pela API HTTP: AuthGuard, ValidationPipe e PtsService reais;
 * SuperTokens e o repositório são substituídos por dublês.
 */
import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';
import request from 'supertest';
import { createValidationPipe } from '../src/common/validation/create-validation-pipe';

type SessionMiddleware = (
  request: Request,
  response: Response,
  next: (error?: unknown) => void,
) => Promise<void>;

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

let PtsController: (typeof import('../src/pts/controllers/pts.controller.js'))['PtsController'];
let PtsHistoryController: (typeof import('../src/pts/controllers/pts-history.controller.js'))['PtsHistoryController'];
let PtsService: (typeof import('../src/pts/services/pts.service.js'))['PtsService'];
let PtsRepository: (typeof import('../src/pts/repositories/pts.repository.js'))['PtsRepository'];
let AccountsService: (typeof import('../src/accounts/services/accounts.service.js'))['AccountsService'];
let AuthGuard: (typeof import('../src/auth/guards/auth.guard.js'))['AuthGuard'];

beforeAll(async () => {
  ({ PtsController } =
    await import('../src/pts/controllers/pts.controller.js'));
  ({ PtsHistoryController } =
    await import('../src/pts/controllers/pts-history.controller.js'));
  ({ PtsService } = await import('../src/pts/services/pts.service.js'));
  ({ PtsRepository } =
    await import('../src/pts/repositories/pts.repository.js'));
  ({ AccountsService } =
    await import('../src/accounts/services/accounts.service.js'));
  ({ AuthGuard } = await import('../src/auth/guards/auth.guard.js'));
});

describe('consultar histórico de PTS (e2e)', () => {
  const patientId = '7c1f0f0e-1d2b-4b43-8a6e-0f2b6c1d9e11';
  const ptsId = '3f2c9a1e-7b4d-4c8e-9f1a-2b3c4d5e6f70';
  const responsibleId = 'a1b2c3d4-e5f6-4789-8abc-def012345678';
  const memberId = 'b1b2c3d4-e5f6-4789-8abc-def012345678';
  const historyItem = {
    id: ptsId,
    version: 1,
    status: 'concluded',
    responsible: {
      id: responsibleId,
      name: 'Ana Souza',
      specialism: 'Psicologia',
    },
    team: [{ id: memberId, name: 'João Lima' }],
    createdAt: '2025-03-01T12:00:00.000Z',
    acceptedAt: '2025-03-05T12:00:00.000Z',
    beganAt: '2025-03-10T12:00:00.000Z',
    closedAt: '2025-12-30T12:00:00.000Z',
    goalsResult: null,
  };
  const detail = {
    id: ptsId,
    status: 'concluded',
    socialSituation: 'Confidencial',
    caseStudyDate: null,
    diagnosisSummary: 'Dados da ficha',
    cid: null,
    supportLevel: null,
    strengths: null,
    priorityNeeds: [],
    vulnerabilities: null,
    comorbidities: null,
    sensoryProfile: null,
    communicationMethod: null,
    nextReviewAt: null,
    createdAt: historyItem.createdAt,
    acceptedAt: historyItem.acceptedAt,
    rejectedAt: null,
    beganAt: historyItem.beganAt,
    concludedAt: historyItem.closedAt,
    cancelledAt: null,
    patient: { id: patientId, name: 'Luna Ferreira' },
    responsible: {
      id: responsibleId,
      name: 'Ana Souza',
      specialism: { id: 'psychologist', name: 'Psicologia' },
      registration: null,
    },
    team: [
      {
        id: memberId,
        name: 'João Lima',
        specialism: { id: 'nurse', name: 'Enfermagem' },
        registration: null,
      },
    ],
  };

  let app: INestApplication;
  let repository: {
    patientExists: jest.Mock<(id: string) => Promise<boolean>>;
    findPtsHistory: jest.Mock<(input: unknown) => Promise<unknown>>;
    findPtsById: jest.Mock<(id: string) => Promise<unknown>>;
  };

  function signIn({
    professionalProfileIds = [],
    patientProfileId = null,
    role = 'user',
  }: {
    professionalProfileIds?: string[];
    patientProfileId?: string | null;
    role?: 'admin' | 'user';
  } = {}) {
    currentSession = {
      getAccessTokenPayload: () => ({
        accountId: patientProfileId ?? 'account-1',
        role,
        patientProfileId,
        professionalProfileIds,
      }),
    };
  }

  beforeEach(async () => {
    repository = {
      patientExists: jest.fn(async () => true),
      findPtsHistory: jest.fn(async () => ({
        rows: [historyItem],
        total: 1,
      })),
      findPtsById: jest.fn(async () => detail),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [PtsController, PtsHistoryController],
      providers: [
        PtsService,
        AuthGuard,
        { provide: AccountsService, useValue: { isActive: async () => true } },
        { provide: PtsRepository, useValue: repository },
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

  it('returns a paginated history to the admin, including closed PTS', async () => {
    signIn({ role: 'admin' });

    const response = await request(app.getHttpServer())
      .get(`/patients/${patientId}/pts?page=1&limit=20`)
      .expect(200);

    expect(response.body).toEqual({
      data: [historyItem],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect(repository.findPtsHistory).toHaveBeenCalledWith({
      patientId,
      professionalProfileIds: [],
      page: 1,
      limit: 20,
    });
  });

  it('limits professional access to their PTS and rejects an unlinked professional', async () => {
    signIn({ professionalProfileIds: [memberId] });

    const response = await request(app.getHttpServer())
      .get(`/patients/${patientId}/pts`)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.pagination).toMatchObject({ page: 1, limit: 20 });
    expect(repository.findPtsHistory).toHaveBeenCalledWith({
      patientId,
      professionalProfileIds: [memberId],
      page: 1,
      limit: 20,
    });

    signIn({
      professionalProfileIds: ['c1b2c3d4-e5f6-4789-8abc-def012345678'],
    });
    repository.findPtsHistory.mockResolvedValue({ rows: [], total: 0 });

    const forbidden = await request(app.getHttpServer())
      .get(`/patients/${patientId}/pts`)
      .expect(403);
    expect(forbidden.body.status).toBe('FORBIDDEN');
  });

  it('returns a closed PTS to its patient without the sheet', async () => {
    signIn({ patientProfileId: patientId });

    const response = await request(app.getHttpServer())
      .get(`/pts/${ptsId}`)
      .expect(200);

    expect(response.body).not.toHaveProperty('socialSituation');
    expect(response.body).not.toHaveProperty('diagnosisSummary');
    expect(response.body).toMatchObject({
      id: ptsId,
      status: 'concluded',
      patient: { id: patientId },
    });
  });

  it('requires a session and validates the patient id', async () => {
    await request(app.getHttpServer())
      .get(`/patients/${patientId}/pts`)
      .expect(401);

    signIn({ role: 'admin' });
    const invalid = await request(app.getHttpServer())
      .get('/patients/not-a-uuid/pts')
      .expect(400);

    expect(invalid.body.status).toBe('VALIDATION_ERROR');
    expect(repository.patientExists).not.toHaveBeenCalled();
  });
});
