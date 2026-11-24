/*
 * Este teste cobre o fluxo HTTP da consulta da timeline (RFTL001):
 * GET /pts/:id/timeline com o AuthGuard real, o ValidationPipe global e o
 * TimelineService real. O SuperTokens e o repositório são trocados por dublês.
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
let TimelineController: (typeof import('../src/timeline/controllers/timeline.controller.js'))['TimelineController'];
let TimelineService: (typeof import('../src/timeline/services/timeline.service.js'))['TimelineService'];
let TimelineRepository: (typeof import('../src/timeline/repositories/timeline.repository.js'))['TimelineRepository'];
let AuthGuard: (typeof import('../src/auth/guards/auth.guard.js'))['AuthGuard'];

beforeAll(async () => {
  ({ TimelineController } =
    await import('../src/timeline/controllers/timeline.controller.js'));
  ({ TimelineService } =
    await import('../src/timeline/services/timeline.service.js'));
  ({ TimelineRepository } =
    await import('../src/timeline/repositories/timeline.repository.js'));
  ({ AuthGuard } = await import('../src/auth/guards/auth.guard.js'));
});

describe('consultar timeline do PTS (e2e)', () => {
  const ptsId = '3f2c9a1e-7b4d-4c8e-9f1a-2b3c4d5e6f70';
  const patientId = '8a7b6c5d-4e3f-4a2b-9c1d-0e9f8a7b6c5d';
  const responsibleId = '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
  const memberId = '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a';
  const outsiderId = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
  const route = `/pts/${ptsId}/timeline`;

  const activityRecord = {
    id: '1e2d3c4b-5a69-4788-9a0b-1c2d3e4f5a6b',
    type: 'activity_approved',
    targetType: 'activity',
    targetId: '9c8b7a65-4d3e-4f21-8a9b-0c1d2e3f4a5b',
    description: 'João Lima aprovou a atividade Integração sensorial',
    happenedAt: new Date('2026-11-12T14:45:00.000Z'),
    author: { id: 'c3', name: 'João Lima' },
    assignedTo: null,
  };
  const documentRecord = {
    id: '2f3e4d5c-6b7a-4899-8a0b-1c2d3e4f5a6c',
    type: 'document_uploaded',
    targetType: 'document',
    targetId: '4b3a2918-7f6e-4d5c-9b4a-3f2e1d0c9b8a',
    description: 'Kaio enviou o documento Laudo neurológico',
    happenedAt: new Date('2026-11-11T09:00:00.000Z'),
    author: { id: 'c-admin', name: 'Kaio' },
    assignedTo: { id: memberId, name: 'João Lima' },
  };

  let app: INestApplication;
  let timelineRepository: {
    insert: jest.Mock<() => Promise<void>>;
    findPtsAccess: jest.Mock<(id: string) => Promise<unknown>>;
    findByPts: jest.Mock<(input: unknown) => Promise<unknown>>;
  };

  function signIn(
    profile: {
      professionalProfileIds?: string[];
      patientProfileId?: string | null;
    },
    role: 'admin' | 'user' = 'user',
  ) {
    currentSession = {
      getAccessTokenPayload: () => ({
        accountId: 'account-1',
        role,
        patientProfileId: profile.patientProfileId ?? null,
        professionalProfileIds: profile.professionalProfileIds ?? [],
      }),
    };
  }

  function seedPts(status = 'running') {
    timelineRepository.findPtsAccess.mockResolvedValue({
      id: ptsId,
      status,
      patientId,
      responsibleProfessionalId: responsibleId,
      teamProfessionalIds: [memberId],
    });
  }

  beforeEach(async () => {
    timelineRepository = {
      insert: jest.fn(),
      findPtsAccess: jest.fn(),
      findByPts: jest.fn(async () => ({
        rows: [activityRecord, documentRecord],
        total: 2,
      })),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [TimelineController],
      providers: [
        TimelineService,
        AuthGuard,
        { provide: TimelineRepository, useValue: timelineRepository },
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

  it('responde 200 com os eventos paginados para o membro da equipe', async () => {
    signIn({ professionalProfileIds: [memberId] });
    seedPts();
    timelineRepository.findByPts.mockResolvedValueOnce({
      rows: [activityRecord],
      total: 1,
    });

    const response = await request(app.getHttpServer()).get(
      `${route}?type=activity&page=1&limit=20`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [
        {
          ...activityRecord,
          happenedAt: '2026-11-12T14:45:00.000Z',
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect(timelineRepository.findByPts).toHaveBeenCalledWith({
      ptsId,
      q: undefined,
      types: ['activity'],
      authorId: undefined,
      from: undefined,
      to: undefined,
      page: 1,
      limit: 20,
    });
  });

  it('repassa busca, tipos, autor, período e ordem normalizados', async () => {
    signIn({ professionalProfileIds: [responsibleId] });
    seedPts();

    const response = await request(app.getHttpServer()).get(route).query({
      q: '  integração ',
      type: 'activity,document',
      authorId: memberId,
      from: '2026-11-01',
      to: '2026-11-30',
      order: 'asc',
      page: '2',
      limit: '5',
    });

    expect(response.status).toBe(200);
    expect(timelineRepository.findByPts).toHaveBeenCalledWith({
      ptsId,
      q: 'integração',
      types: ['activity', 'document'],
      authorId: memberId,
      from: '2026-11-01',
      to: '2026-11-30',
      order: 'asc',
      page: 2,
      limit: 5,
    });
    expect(response.body.pagination).toEqual({
      page: 2,
      limit: 5,
      total: 2,
      totalPages: 1,
    });
  });

  it('dá ao admin a timeline com o alvo dos documentos', async () => {
    signIn({}, 'admin');
    seedPts();

    const response = await request(app.getHttpServer()).get(route);

    expect(response.status).toBe(200);
    expect(response.body.data[1]).toMatchObject({
      targetType: 'document',
      targetId: documentRecord.targetId,
      assignedTo: { id: memberId, name: 'João Lima' },
    });
  });

  it('dá ao paciente titular a timeline sem o alvo dos documentos', async () => {
    signIn({ patientProfileId: patientId });
    seedPts();

    const response = await request(app.getHttpServer()).get(route);

    expect(response.status).toBe(200);
    expect(response.body.data[0].targetId).toBe(activityRecord.targetId);
    expect(response.body.data[1]).toMatchObject({
      targetType: 'document',
      targetId: null,
    });
  });

  it('responde 401 sem sessão', async () => {
    const response = await request(app.getHttpServer()).get(route);

    expect(response.status).toBe(401);
    expect(timelineRepository.findPtsAccess).not.toHaveBeenCalled();
  });

  it('responde 400 quando o id do PTS não é UUID', async () => {
    signIn({ professionalProfileIds: [memberId] });

    const response = await request(app.getHttpServer()).get(
      '/pts/nao-e-uuid/timeline',
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 'VALIDATION_ERROR',
      message: 'Parâmetro inválido: id',
    });
  });

  it.each([
    ['type', 'type=goal'],
    ['authorId', 'authorId=joao'],
    ['from', 'from=01-11-2026'],
    ['to', 'to=2026-02-30'],
    ['page', 'page=0'],
    ['limit', 'limit=51'],
    ['order', 'order=up'],
  ])('responde 400 com %s inválido', async (field, queryString) => {
    signIn({ professionalProfileIds: [memberId] });
    seedPts();

    const response = await request(app.getHttpServer()).get(
      `${route}?${queryString}`,
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 'ERROR',
      message: `Parâmetro inválido: ${field}`,
    });
    expect(timelineRepository.findByPts).not.toHaveBeenCalled();
  });

  it('responde 400 quando o período começa depois de terminar', async () => {
    signIn({ professionalProfileIds: [memberId] });
    seedPts();

    const response = await request(app.getHttpServer()).get(
      `${route}?from=2026-11-30&to=2026-11-01`,
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 'ERROR',
      message: 'Parâmetro inválido: from',
    });
  });

  it('responde 403 ao profissional fora da equipe', async () => {
    signIn({ professionalProfileIds: [outsiderId] });
    seedPts();

    const response = await request(app.getHttpServer()).get(route);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      status: 'FORBIDDEN',
      message: 'Você não tem acesso à timeline deste PTS.',
    });
    expect(timelineRepository.findByPts).not.toHaveBeenCalled();
  });

  it('responde 403 a outro paciente', async () => {
    signIn({ patientProfileId: outsiderId });
    seedPts();

    const response = await request(app.getHttpServer()).get(route);

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ status: 'FORBIDDEN' });
  });

  it('responde 404 quando o PTS não existe', async () => {
    signIn({}, 'admin');
    timelineRepository.findPtsAccess.mockResolvedValue(null);

    const response = await request(app.getHttpServer()).get(route);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      status: 'PTS_NOT_FOUND',
      message: 'PTS não encontrado.',
    });
  });
});
