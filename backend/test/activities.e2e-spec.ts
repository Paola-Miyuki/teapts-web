import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';
import request from 'supertest';
import { createValidationPipe } from '../src/common/validation/create-validation-pipe';
import { PtsStateEnum } from '../src/database/enums/pts-state.enum';
import { seededGoalsRepo } from '../src/pts/__tests__/goal-fixtures';
import {
  activityBody,
  InMemoryActivitiesRepository,
} from '../src/activities/__tests__/activity-fixtures';

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

let ActivitiesController: (typeof import('../src/activities/controllers/activities.controller.js'))['ActivitiesController'];
let ActivitiesService: (typeof import('../src/activities/services/activities.service.js'))['ActivitiesService'];
let ActivitiesRepository: (typeof import('../src/activities/repositories/activities.repository.js'))['ActivitiesRepository'];
let PtsGoalsRepository: (typeof import('../src/pts/repositories/pts-goals.repository.js'))['PtsGoalsRepository'];
let AccountsService: (typeof import('../src/accounts/services/accounts.service.js'))['AccountsService'];
let AuthGuard: (typeof import('../src/auth/guards/auth.guard.js'))['AuthGuard'];

beforeAll(async () => {
  ({ ActivitiesController } =
    await import('../src/activities/controllers/activities.controller.js'));
  ({ ActivitiesService } =
    await import('../src/activities/services/activities.service.js'));
  ({ ActivitiesRepository } =
    await import('../src/activities/repositories/activities.repository.js'));
  ({ PtsGoalsRepository } =
    await import('../src/pts/repositories/pts-goals.repository.js'));
  ({ AccountsService } =
    await import('../src/accounts/services/accounts.service.js'));
  ({ AuthGuard } = await import('../src/auth/guards/auth.guard.js'));
});

describe('criar atividade (e2e - RFACT001)', () => {
  const ptsId = '3f2e1d0c-9b8a-4765-a432-10fedcba9876';
  const goalId = '22222222-2222-4222-8222-222222222222';
  const memberId = '11111111-1111-4111-8111-111111111111';
  const otherId = '99999999-9999-4999-8999-999999999999';
  const route = `/pts/${ptsId}/activities`;

  let app: INestApplication;
  let goalsRepo: ReturnType<typeof seededGoalsRepo>;
  let repo: InMemoryActivitiesRepository;

  function signIn(
    professionalProfileIds: string[],
    options: { role?: string; patientProfileId?: string | null } = {},
  ) {
    currentSession = {
      getAccessTokenPayload: () => ({
        accountId: 'account-1',
        role: options.role ?? 'user',
        patientProfileId: options.patientProfileId ?? null,
        professionalProfileIds,
      }),
    };
  }

  const post = (changes: Record<string, unknown> = {}) =>
    request(app.getHttpServer())
      .post(route)
      .send({ ...activityBody(), ...changes });

  beforeEach(async () => {
    repo = new InMemoryActivitiesRepository();
    goalsRepo = seededGoalsRepo();
    Object.assign(goalsRepo.pts[0], {
      id: ptsId,
      teamProfessionalIds: [memberId],
    });
    Object.assign(goalsRepo.goals[0], { id: goalId, ptsId });

    const moduleRef = await Test.createTestingModule({
      controllers: [ActivitiesController],
      providers: [
        ActivitiesService,
        AuthGuard,
        { provide: AccountsService, useValue: { isActive: async () => true } },
        { provide: ActivitiesRepository, useValue: repo },
        { provide: PtsGoalsRepository, useValue: goalsRepo },
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

  it('cria a atividade suggested e ela aparece na lista', async () => {
    signIn([memberId]);

    const created = await post({
      goalId,
      executorProfessionalIds: [memberId],
    }).expect(201);

    expect(created.body).toMatchObject({
      title: 'Integração sensorial',
      status: 'suggested',
      frequency: { quantity: 1, period: 'weekly', durationMinutes: 45 },
      createdAt: '2026-12-01T13:00:00.000Z',
    });
    expect(repo.created[0]).toMatchObject({
      authorProfessionalId: memberId,
      executedByAccountId: 'account-1',
    });

    const listed = await request(app.getHttpServer()).get(route).expect(200);
    expect(listed.body).toEqual({
      data: [created.body],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it('responde 401 sem sessão', async () => {
    await post().expect(401);
    await request(app.getHttpServer()).get(route).expect(401);
  });

  it.each([
    undefined,
    'x',
    { quantity: 0, period: 'weekly', durationMinutes: 45 },
    { quantity: 1, period: 'daily', durationMinutes: 45 },
  ])('responde 422 INVALID_FREQUENCY com %j', async (frequency) => {
    signIn([memberId]);

    const response = await post({ frequency }).expect(422);

    expect(response.body).toEqual({
      status: 'INVALID_FREQUENCY',
      message: 'Frequência inválida: informe quantidade, período e duração.',
    });
    expect(repo.created).toHaveLength(0);
  });

  it.each([
    ['sem título', { title: ' ' }],
    ['visita externa sem local', { modality: 'external_visit' }],
    ['meta de outro PTS', { goalId: otherId }],
    ['documento de outro paciente', { documentIds: [otherId] }],
    ['executor fora da equipe', { executorProfessionalIds: [otherId] }],
  ])('responde 400 VALIDATION_ERROR: %s', async (_name, changes) => {
    signIn([memberId]);

    const response = await post(changes).expect(400);

    expect(response.body).toMatchObject({ status: 'VALIDATION_ERROR' });
    expect(repo.created).toHaveLength(0);
  });

  it('nega ao profissional de fora e ao paciente, que só vê a lista', async () => {
    signIn([otherId]);
    await post().expect(403);

    signIn([], { patientProfileId: 'patient-1' });
    const response = await post().expect(403);
    expect(response.body).toMatchObject({ status: 'FORBIDDEN' });
    await request(app.getHttpServer()).get(route).expect(200);
  });

  it('responde 404 PTS_NOT_FOUND e 409 PTS_NOT_EDITABLE', async () => {
    signIn([memberId]);

    const missing = await request(app.getHttpServer())
      .post(`/pts/${otherId}/activities`)
      .send(activityBody())
      .expect(404);
    expect(missing.body).toMatchObject({ status: 'PTS_NOT_FOUND' });

    goalsRepo.pts[0].status = PtsStateEnum.CONCLUDED;
    const closed = await post().expect(409);
    expect(closed.body).toMatchObject({ status: 'PTS_NOT_EDITABLE' });
  });
});
