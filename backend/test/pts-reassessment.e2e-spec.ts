/*
- RFEVA005 pela rota HTTP, com o AuthGuard e o PtsReassessmentService reais.
  SuperTokens e repositórios são trocados por dublês.
 */
import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';
import request from 'supertest';
import { createValidationPipe } from '../src/common/validation/create-validation-pipe';
import { PtsStateEnum } from '../src/database/enums/pts-state.enum';
import { GoalStatus } from '../src/pts/enums/goal.enums';
import { seededGoalsRepo } from '../src/pts/__tests__/goal-fixtures';
import { InMemoryPtsReassessmentRepository } from '../src/pts/__tests__/in-memory-pts-reassessment.repository';

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

let PtsReassessmentController: (typeof import('../src/pts/controllers/pts-reassessment.controller.js'))['PtsReassessmentController'];
let PtsReassessmentService: (typeof import('../src/pts/services/pts-reassessment.service.js'))['PtsReassessmentService'];
let PtsReassessmentRepository: (typeof import('../src/pts/repositories/pts-reassessment.repository.js'))['PtsReassessmentRepository'];
let PtsGoalsRepository: (typeof import('../src/pts/repositories/pts-goals.repository.js'))['PtsGoalsRepository'];
let AccountsService: (typeof import('../src/accounts/services/accounts.service.js'))['AccountsService'];
let AuthGuard: (typeof import('../src/auth/guards/auth.guard.js'))['AuthGuard'];

beforeAll(async () => {
  ({ PtsReassessmentController } =
    await import('../src/pts/controllers/pts-reassessment.controller.js'));
  ({ PtsReassessmentService } =
    await import('../src/pts/services/pts-reassessment.service.js'));
  ({ PtsReassessmentRepository } =
    await import('../src/pts/repositories/pts-reassessment.repository.js'));
  ({ PtsGoalsRepository } =
    await import('../src/pts/repositories/pts-goals.repository.js'));
  ({ AccountsService } =
    await import('../src/accounts/services/accounts.service.js'));
  ({ AuthGuard } = await import('../src/auth/guards/auth.guard.js'));
});

describe('registrar reavaliação (e2e - RFEVA005)', () => {
  const ptsId = '3f2c9a1e-7b4d-4c8e-9f1a-2b3c4d5e6f70';
  const goalOne = '5d7a1b3c-9e2f-4a6b-8c0d-1e2f3a4b5c6d';
  const goalTwo = '6e8b2c4d-0f3a-4b7c-9d1e-2f3a4b5c6d7e';
  const responsibleId = '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
  const memberId = '11111111-1111-4111-8111-111111111111';
  const route = `/pts/${ptsId}/reassessment`;
  const body = (changes: Record<string, unknown> = {}) => ({
    meetingDate: '2026-12-15',
    goals: [
      { goalId: goalOne, status: 'achieved' },
      {
        goalId: goalTwo,
        status: 'partially_achieved',
        note: 'Conversa 2 vezes por semana.',
      },
    ],
    createNextVersion: true,
    ...changes,
  });

  let app: INestApplication;
  let goalsRepo: ReturnType<typeof seededGoalsRepo>;
  let repo: InMemoryPtsReassessmentRepository;

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

  const post = (payload: Record<string, unknown> = body(), path = route) =>
    request(app.getHttpServer()).post(path).send(payload);

  beforeEach(async () => {
    repo = new InMemoryPtsReassessmentRepository();
    goalsRepo = seededGoalsRepo();
    Object.assign(goalsRepo.pts[0], {
      id: ptsId,
      responsibleProfessionalId: responsibleId,
      teamProfessionalIds: [memberId],
    });
    Object.assign(goalsRepo.goals[0], { id: goalOne, ptsId });
    Object.assign(goalsRepo.goals[1], { id: goalTwo, ptsId });

    const moduleRef = await Test.createTestingModule({
      controllers: [PtsReassessmentController],
      providers: [
        PtsReassessmentService,
        AuthGuard,
        { provide: AccountsService, useValue: { isActive: async () => true } },
        { provide: PtsReassessmentRepository, useValue: repo },
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

  it('o responsável registra, conclui e recebe o id do rascunho v2', async () => {
    signIn([responsibleId]);

    const response = await post().expect(200);

    expect(response.body).toEqual({
      id: ptsId,
      status: 'concluded',
      reassessedAt: '2026-12-15',
      nextPtsId: 'pts-2',
    });
    expect(repo.registered[0]).toMatchObject({
      goals: [
        { goalId: goalOne, status: 'achieved', note: null },
        {
          goalId: goalTwo,
          status: 'partially_achieved',
          note: 'Conversa 2 vezes por semana.',
        },
      ],
      actor: { accountId: 'account-1', professionalId: responsibleId },
    });
  });

  it('"Encerrar sem novo PTS" devolve nextPtsId nulo, também para o admin', async () => {
    signIn([], { role: 'admin' });

    const response = await post(
      body({ createNextVersion: false, reason: 'Alta do paciente.' }),
    ).expect(200);

    expect(response.body.nextPtsId).toBeNull();
    expect(repo.registered[0]).toMatchObject({
      reason: 'Alta do paciente.',
      actor: { professionalId: null },
    });
  });

  it('responde 401 sem sessão', async () => {
    await post().expect(401);
  });

  it('responde 400 GOALS_WITHOUT_RESULT dizendo quantas faltam', async () => {
    signIn([responsibleId]);

    const response = await post(
      body({ goals: [{ goalId: goalOne, status: 'achieved' }] }),
    ).expect(400);

    expect(response.body).toMatchObject({
      status: 'GOALS_WITHOUT_RESULT',
      message: 'Falta 1 meta sem resultado.',
    });
    expect(repo.registered).toHaveLength(0);
  });

  it.each([
    ['id inválido', body(), '/pts/x/reassessment'],
    ['data inválida', body({ meetingDate: '2026-02-30' }), route],
    [
      'resultado inválido',
      body({ goals: [{ goalId: goalOne, status: GoalStatus.InProgress }] }),
      route,
    ],
    ['sem createNextVersion', body({ createNextVersion: undefined }), route],
  ])('responde 400 VALIDATION_ERROR: %s', async (_name, payload, path) => {
    signIn([responsibleId]);

    const response = await post(payload, path).expect(400);

    expect(response.body).toMatchObject({ status: 'VALIDATION_ERROR' });
    expect(repo.registered).toHaveLength(0);
  });

  it('nega a outro profissional da equipe e ao paciente', async () => {
    signIn([memberId]);
    const member = await post().expect(403);
    expect(member.body).toMatchObject({ status: 'FORBIDDEN' });

    signIn([], { patientProfileId: 'patient-1' });
    await post().expect(403);
  });

  it('responde 404 PTS_NOT_FOUND e 409 PTS_NOT_RUNNING', async () => {
    signIn([responsibleId]);

    const missing = await post(
      body(),
      '/pts/99999999-9999-4999-8999-999999999999/reassessment',
    ).expect(404);
    expect(missing.body).toMatchObject({ status: 'PTS_NOT_FOUND' });

    goalsRepo.pts[0].status = PtsStateEnum.PLANNING;
    const planning = await post().expect(409);
    expect(planning.body).toEqual({
      status: 'PTS_NOT_RUNNING',
      message: 'Só um PTS em andamento pode ser reavaliado.',
    });
  });
});
