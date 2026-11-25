import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';
import request from 'supertest';
import { createValidationPipe } from '../src/common/validation/create-validation-pipe';
import { PtsStateEnum } from '../src/database/enums/pts-state.enum';
import { seededGoalsRepo } from '../src/pts/__tests__/goal-fixtures';
import { ActivityState } from '../src/activities/enums/activity.enums';
import {
  InMemoryActivitiesRepository,
  storedActivity,
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

let ActivityController: (typeof import('../src/activities/controllers/activity.controller.js'))['ActivityController'];
let ActivitiesService: (typeof import('../src/activities/services/activities.service.js'))['ActivitiesService'];
let ActivitiesRepository: (typeof import('../src/activities/repositories/activities.repository.js'))['ActivitiesRepository'];
let PtsGoalsRepository: (typeof import('../src/pts/repositories/pts-goals.repository.js'))['PtsGoalsRepository'];
let AccountsService: (typeof import('../src/accounts/services/accounts.service.js'))['AccountsService'];
let AuthGuard: (typeof import('../src/auth/guards/auth.guard.js'))['AuthGuard'];

beforeAll(async () => {
  ({ ActivityController } =
    await import('../src/activities/controllers/activity.controller.js'));
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

describe('aprovar ou rejeitar atividade (e2e - RFACT003)', () => {
  const ptsId = '3f2e1d0c-9b8a-4765-a432-10fedcba9876';
  const activityId = '66666666-6666-4666-8666-666666666660';
  const responsibleId = '44444444-4444-4444-8444-444444444444';
  const memberId = '11111111-1111-4111-8111-111111111111';
  const otherId = '99999999-9999-4999-8999-999999999999';
  const route = (action: string, id = activityId) =>
    `/activities/${id}/${action}`;

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

  const post = (action: string, body: Record<string, unknown> = {}) =>
    request(app.getHttpServer()).post(route(action)).send(body);

  beforeEach(async () => {
    repo = new InMemoryActivitiesRepository();
    repo.activities.push(
      storedActivity({
        id: activityId,
        ptsId,
        authorProfessionalId: responsibleId,
        status: ActivityState.Suggested,
      }),
    );
    goalsRepo = seededGoalsRepo();
    Object.assign(goalsRepo.pts[0], {
      id: ptsId,
      responsibleProfessionalId: responsibleId,
      teamProfessionalIds: [memberId],
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [ActivityController],
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

  it('o autor aprova a própria sugestão, que entra em execução', async () => {
    signIn([responsibleId]);

    const response = await post('approve').expect(200);

    expect(response.body).toEqual({
      id: activityId,
      status: 'running',
      decidedAt: '2026-12-02T12:00:00.000Z',
    });
    expect(repo.decisions[0]).toMatchObject({
      decision: 'approve',
      reason: null,
      authorProfessionalId: responsibleId,
      executedByAccountId: 'account-1',
    });
  });

  it('um membro rejeita com o motivo', async () => {
    signIn([memberId]);

    const response = await post('reject', {
      reason: 'Já existe atividade equivalente.',
    }).expect(200);

    expect(response.body).toMatchObject({ status: 'rejected' });
    expect(repo.decisions[0]).toMatchObject({
      decision: 'reject',
      reason: 'Já existe atividade equivalente.',
      authorProfessionalId: memberId,
    });
  });

  it('o admin também decide', async () => {
    signIn([], { role: 'admin' });

    await post('reject').expect(200);

    expect(repo.decisions[0]).toMatchObject({ authorProfessionalId: null });
  });

  describe.each(['approve', 'reject'])('%s', (action) => {
    it('responde 401, 400 e 404', async () => {
      await post(action).expect(401);

      signIn([memberId]);
      await request(app.getHttpServer())
        .post(`/activities/x/${action}`)
        .expect(400);
      const missing = await request(app.getHttpServer())
        .post(route(action, otherId))
        .expect(404);
      expect(missing.body).toMatchObject({ status: 'ACTIVITY_NOT_FOUND' });
    });

    it('nega a quem é de fora e ao paciente', async () => {
      signIn([otherId]);
      const outsider = await post(action).expect(403);
      expect(outsider.body).toMatchObject({ status: 'FORBIDDEN' });

      signIn([], { patientProfileId: 'patient-1' });
      await post(action).expect(403);
      expect(repo.decisions).toHaveLength(0);
    });

    it('responde 409 ACTIVITY_NOT_SUGGESTED fora de suggested', async () => {
      repo.activities[0].status = ActivityState.Running;
      signIn([memberId]);

      const response = await post(action).expect(409);

      expect(response.body).toEqual({
        status: 'ACTIVITY_NOT_SUGGESTED',
        message: 'Só uma atividade sugerida recebe decisão.',
      });
    });

    it('responde 409 PTS_NOT_EDITABLE com o PTS encerrado', async () => {
      goalsRepo.pts[0].status = PtsStateEnum.CANCELLED;
      signIn([memberId]);

      const response = await post(action).expect(409);

      expect(response.body).toMatchObject({ status: 'PTS_NOT_EDITABLE' });
    });
  });

  it('recusa motivo que não é texto na rejeição', async () => {
    signIn([memberId]);

    const response = await post('reject', { reason: 123 }).expect(400);

    expect(response.body).toEqual({
      status: 'VALIDATION_ERROR',
      message: 'O motivo deve ser um texto.',
    });
  });
});
