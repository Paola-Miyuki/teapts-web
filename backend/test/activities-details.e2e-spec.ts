import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';
import request from 'supertest';
import { createValidationPipe } from '../src/common/validation/create-validation-pipe';
import { seededGoalsRepo } from '../src/pts/__tests__/goal-fixtures';
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

describe('consultar atividade (e2e - RFACT002)', () => {
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

  const get = (path = route) => request(app.getHttpServer()).get(path);

  beforeEach(async () => {
    repo = new InMemoryActivitiesRepository();
    repo.activities.push(
      storedActivity({
        id: activityId,
        ptsId,
        authorProfessionalId: memberId,
        goalId,
        documentIds: ['doc-1'],
      }),
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

  it('a equipe e o admin veem o detalhe com a meta e os documentos', async () => {
    for (const enter of [
      () => signIn([memberId]),
      () => signIn([], { role: 'admin' }),
    ]) {
      enter();
      const response = await get().expect(200);

      expect(response.body).toMatchObject({
        id: activityId,
        goal: { id: goalId },
        documents: [{ id: 'doc-1' }],
        appointmentsCount: 0,
      });
    }
  });

  it('o paciente titular vê o detalhe sem os documentos (RN028)', async () => {
    signIn([], { patientProfileId: goalsRepo.pts[0].patientId });

    const response = await get().expect(200);

    expect(response.body).toMatchObject({
      id: activityId,
      documentIds: [],
      documents: [],
    });
  });

  it('nega sem sessão, a quem é de fora e a outro paciente', async () => {
    await get().expect(401);

    signIn([otherId]);
    const outsider = await get().expect(403);
    expect(outsider.body).toMatchObject({ status: 'FORBIDDEN' });

    signIn([], { patientProfileId: otherId });
    await get().expect(403);
  });

  it('responde 400 com o id inválido e 404 com o desconhecido', async () => {
    signIn([memberId]);

    await get('/activities/x').expect(400);
    const missing = await get(`/activities/${otherId}`).expect(404);
    expect(missing.body).toMatchObject({ status: 'ACTIVITY_NOT_FOUND' });
  });
});
