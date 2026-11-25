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

describe('editar atividade (e2e - RFACT005)', () => {
  const ptsId = '3f2e1d0c-9b8a-4765-a432-10fedcba9876';
  const activityId = '66666666-6666-4666-8666-666666666660';
  const goalId = '22222222-2222-4222-8222-222222222222';
  const responsibleId = '44444444-4444-4444-8444-444444444444';
  const memberId = '11111111-1111-4111-8111-111111111111';
  const otherId = '99999999-9999-4999-8999-999999999999';
  const route = `/activities/${activityId}`;

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

  const patch = (body: Record<string, unknown>, path = route) =>
    request(app.getHttpServer()).patch(path).send(body);

  beforeEach(async () => {
    repo = new InMemoryActivitiesRepository();
    repo.activities.push(
      storedActivity({ id: activityId, ptsId, authorProfessionalId: memberId }),
    );
    goalsRepo = seededGoalsRepo();
    Object.assign(goalsRepo.pts[0], {
      id: ptsId,
      responsibleProfessionalId: responsibleId,
      teamProfessionalIds: [memberId],
    });
    Object.assign(goalsRepo.goals[0], { id: goalId, ptsId });

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

  it('o autor edita a sugerida e recebe a atividade atualizada', async () => {
    signIn([memberId]);
    const frequency = { quantity: 2, period: 'biweekly', durationMinutes: 30 };

    const response = await patch({
      title: 'Circuito sensorial',
      frequency,
      goalId,
    }).expect(200);

    expect(response.body).toMatchObject({
      id: activityId,
      title: 'Circuito sensorial',
      status: 'suggested',
      frequency,
      goalId,
      updatedAt: '2026-12-02T13:00:00.000Z',
    });
    expect(repo.updated[0]).toMatchObject({
      authorProfessionalId: memberId,
      executedByAccountId: 'account-1',
    });
  });

  it('o responsável edita a em andamento e o admin, a concluída (RN022)', async () => {
    repo.activities[0].status = ActivityState.Running;
    signIn([responsibleId]);
    await patch({ title: 'Pelo responsável' }).expect(200);

    repo.activities[0].status = ActivityState.Concluded;
    signIn([], { role: 'admin' });
    await patch({ title: 'Pelo admin' }).expect(200);

    expect(repo.updated).toHaveLength(2);
  });

  it('desliga a meta com goalId null', async () => {
    repo.activities[0].goalId = goalId;
    signIn([memberId]);

    const response = await patch({ goalId: null }).expect(200);

    expect(response.body.goalId).toBeNull();
  });

  it('responde 401 sem sessão', async () => {
    await patch({ title: 'Sem sessão' }).expect(401);
  });

  it.each([
    ['sem campos', {}],
    ['título vazio', { title: ' ' }],
    ['goalId inválido', { goalId: 'x' }],
    ['visita externa sem local', { modality: 'external_visit' }],
    ['meta de outro PTS', { goalId: otherId }],
    ['documento de outro paciente', { documentIds: [otherId] }],
  ])('responde 400 VALIDATION_ERROR: %s', async (_name, body) => {
    signIn([memberId]);

    const response = await patch(body).expect(400);

    expect(response.body).toMatchObject({ status: 'VALIDATION_ERROR' });
    expect(repo.updated).toHaveLength(0);
  });

  it('responde 400 com o id inválido', async () => {
    signIn([memberId]);

    const response = await patch({ title: 'x' }, '/activities/x').expect(400);

    expect(response.body).toEqual({
      status: 'VALIDATION_ERROR',
      message: 'Parâmetro inválido: id',
    });
  });

  it('responde 422 INVALID_FREQUENCY', async () => {
    signIn([memberId]);

    const response = await patch({
      frequency: { quantity: 0, period: 'weekly', durationMinutes: 45 },
    }).expect(422);

    expect(response.body).toEqual({
      status: 'INVALID_FREQUENCY',
      message: 'Frequência inválida: informe quantidade, período e duração.',
    });
  });

  it('nega a quem não pode editar', async () => {
    signIn([otherId]);
    await patch({ title: 'x' }).expect(403);

    signIn([], { patientProfileId: 'patient-1' });
    await patch({ title: 'x' }).expect(403);

    // O autor não edita a em andamento.
    repo.activities[0].status = ActivityState.Running;
    signIn([memberId]);
    const response = await patch({ title: 'x' }).expect(403);
    expect(response.body).toMatchObject({ status: 'FORBIDDEN' });
    expect(repo.updated).toHaveLength(0);
  });

  it('responde 404 ACTIVITY_NOT_FOUND', async () => {
    signIn([memberId]);

    const response = await patch(
      { title: 'x' },
      `/activities/${otherId}`,
    ).expect(404);

    expect(response.body).toMatchObject({ status: 'ACTIVITY_NOT_FOUND' });
  });

  it('responde 409 com a atividade arquivada ou o PTS encerrado', async () => {
    signIn([], { role: 'admin' });

    repo.activities[0].status = ActivityState.Archived;
    const archived = await patch({ title: 'x' }).expect(409);
    expect(archived.body).toEqual({
      status: 'ACTIVITY_NOT_EDITABLE',
      message: 'Atividade rejeitada ou arquivada não pode ser editada.',
    });

    repo.activities[0].status = ActivityState.Suggested;
    goalsRepo.pts[0].status = PtsStateEnum.CONCLUDED;
    const closed = await patch({ title: 'x' }).expect(409);
    expect(closed.body).toMatchObject({ status: 'PTS_NOT_EDITABLE' });
  });
});
