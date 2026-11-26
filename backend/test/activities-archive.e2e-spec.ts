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

describe('arquivar atividade (e2e - RFACT008)', () => {
  const ptsId = '3f2e1d0c-9b8a-4765-a432-10fedcba9876';
  const activityId = '66666666-6666-4666-8666-666666666660';
  const responsibleId = '44444444-4444-4444-8444-444444444444';
  const memberId = '11111111-1111-4111-8111-111111111111';
  const otherId = '99999999-9999-4999-8999-999999999999';
  const route = `/activities/${activityId}/archive`;

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

  const post = (body: Record<string, unknown> = {}, path = route) =>
    request(app.getHttpServer()).post(path).send(body);

  beforeEach(async () => {
    repo = new InMemoryActivitiesRepository();
    repo.activities.push(
      storedActivity({
        id: activityId,
        ptsId,
        authorProfessionalId: responsibleId,
        status: ActivityState.Running,
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

  it('um membro da equipe arquiva com o motivo e recebe 200', async () => {
    signIn([memberId]);

    const response = await post({
      reason: 'Família assumiu a atividade em casa.',
    }).expect(200);

    expect(response.body).toEqual({
      id: activityId,
      status: 'archived',
      archivedAt: '2026-12-06T12:00:00.000Z',
    });
    expect(repo.archived[0]).toMatchObject({
      reason: 'Família assumiu a atividade em casa.',
      authorProfessionalId: memberId,
      executedByAccountId: 'account-1',
    });
  });

  it('o admin arquiva sem motivo', async () => {
    signIn([], { role: 'admin' });

    await post().expect(200);

    expect(repo.archived[0]).toMatchObject({
      reason: null,
      authorProfessionalId: null,
    });
  });

  it('responde 401 sem sessão', async () => {
    await post().expect(401);
  });

  it('responde 400 com o id inválido ou o motivo que não é texto', async () => {
    signIn([memberId]);

    const invalidId = await post({}, '/activities/x/archive').expect(400);
    expect(invalidId.body).toEqual({
      status: 'VALIDATION_ERROR',
      message: 'Parâmetro inválido: id',
    });

    const invalidReason = await post({ reason: 123 }).expect(400);
    expect(invalidReason.body).toEqual({
      status: 'VALIDATION_ERROR',
      message: 'O motivo deve ser um texto.',
    });
    expect(repo.archived).toHaveLength(0);
  });

  it('nega a quem é de fora da equipe e ao paciente', async () => {
    signIn([otherId]);
    const outsider = await post().expect(403);
    expect(outsider.body).toMatchObject({ status: 'FORBIDDEN' });

    signIn([], { patientProfileId: 'patient-1' });
    await post().expect(403);
    expect(repo.archived).toHaveLength(0);
  });

  it('responde 404 ACTIVITY_NOT_FOUND', async () => {
    signIn([memberId]);

    const response = await post({}, `/activities/${otherId}/archive`).expect(
      404,
    );

    expect(response.body).toMatchObject({ status: 'ACTIVITY_NOT_FOUND' });
  });

  it.each([ActivityState.Rejected, ActivityState.Archived])(
    'responde 409 ACTIVITY_NOT_ARCHIVABLE com a atividade %s',
    async (status) => {
      repo.activities[0].status = status;
      signIn([memberId]);

      const response = await post().expect(409);

      expect(response.body).toEqual({
        status: 'ACTIVITY_NOT_ARCHIVABLE',
        message:
          'Atividade rejeitada, concluída ou já arquivada não pode ser arquivada.',
      });
    },
  );

  it('responde 409 PTS_NOT_EDITABLE com o PTS encerrado', async () => {
    goalsRepo.pts[0].status = PtsStateEnum.CANCELLED;
    signIn([memberId]);

    const response = await post().expect(409);

    expect(response.body).toMatchObject({ status: 'PTS_NOT_EDITABLE' });
  });
});
