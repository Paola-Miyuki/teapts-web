import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';
import request from 'supertest';
import { createValidationPipe } from '../src/common/validation/create-validation-pipe';
import { PtsStateEnum } from '../src/database/enums/pts-state.enum';
import {
  goalBody,
  seededGoalsRepo,
  storedGoal,
} from '../src/pts/__tests__/goal-fixtures';
import type { InMemoryPtsGoalsRepository } from '../src/pts/__tests__/in-memory-pts-goals.repository';

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

let PtsGoalsController: (typeof import('../src/pts/controllers/pts-goals.controller.js'))['PtsGoalsController'];
let PtsGoalsService: (typeof import('../src/pts/services/pts-goals.service.js'))['PtsGoalsService'];
let PtsGoalsRepository: (typeof import('../src/pts/repositories/pts-goals.repository.js'))['PtsGoalsRepository'];
let AccountsService: (typeof import('../src/accounts/services/accounts.service.js'))['AccountsService'];
let AuthGuard: (typeof import('../src/auth/guards/auth.guard.js'))['AuthGuard'];

beforeAll(async () => {
  ({ PtsGoalsController } =
    await import('../src/pts/controllers/pts-goals.controller.js'));
  ({ PtsGoalsService } =
    await import('../src/pts/services/pts-goals.service.js'));
  ({ PtsGoalsRepository } =
    await import('../src/pts/repositories/pts-goals.repository.js'));
  ({ AccountsService } =
    await import('../src/accounts/services/accounts.service.js'));
  ({ AuthGuard } = await import('../src/auth/guards/auth.guard.js'));
});

describe('metas terapêuticas (e2e - RFPTS012)', () => {
  const ptsId = '3f2e1d0c-9b8a-4765-a432-10fedcba9876';
  const goalId = '22222222-2222-4222-8222-222222222222';
  const otherGoalId = '33333333-3333-4333-8333-333333333333';
  const responsibleId = '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
  const memberId = '11111111-1111-4111-8111-111111111111';
  const list = `/pts/${ptsId}/goals`;
  const item = `${list}/${goalId}`;

  let app: INestApplication;
  let repo: InMemoryPtsGoalsRepository;

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

  const http = () => request(app.getHttpServer());

  beforeEach(async () => {
    repo = seededGoalsRepo();
    Object.assign(repo.pts[0], {
      id: ptsId,
      responsibleProfessionalId: responsibleId,
      teamProfessionalIds: [memberId],
    });
    repo.goals = [goalId, otherGoalId].map((id) => ({
      ...storedGoal(id),
      ptsId,
    }));

    const moduleRef = await Test.createTestingModule({
      controllers: [PtsGoalsController],
      providers: [
        PtsGoalsService,
        AuthGuard,
        { provide: AccountsService, useValue: { isActive: async () => true } },
        { provide: PtsGoalsRepository, useValue: repo },
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

  it('cadastra, lista, edita e exclui a meta como membro da equipe', async () => {
    signIn([memberId]);

    const created = await http().post(list).send(goalBody()).expect(201);
    expect(created.body).toMatchObject({
      ...goalBody(),
      status: 'in_progress',
      origin: 'new',
      activitiesCount: 0,
    });
    expect((await http().get(list).expect(200)).body.data).toHaveLength(3);

    const edited = await http()
      .patch(item)
      .send({ targetDate: '2027-01-15' })
      .expect(200);
    expect(edited.body).toMatchObject({ targetDate: '2027-01-15' });

    const removed = await http().delete(item).expect(200);
    expect(removed.body).toEqual({ status: 'OK' });
    expect((await http().get(list)).body.data).toHaveLength(2);

    for (const write of [repo.created[0], repo.updated[0], repo.removed[0]]) {
      expect(write).toMatchObject({
        authorProfessionalId: memberId,
        executedByAccountId: 'account-1',
      });
    }
  });

  it('o admin cadastra e atribui a autoria (RN029)', async () => {
    signIn([], { role: 'admin' });

    await http()
      .post(list)
      .send({ ...goalBody(), authorProfessionalId: responsibleId })
      .expect(201);

    expect(repo.created[0]).toMatchObject({
      authorProfessionalId: responsibleId,
      executedByAccountId: 'account-1',
    });
  });

  it('o paciente titular só vê', async () => {
    signIn([], { patientProfileId: 'patient-1' });

    await http().get(list).expect(200);

    const responses = [
      await http().post(list).send(goalBody()),
      await http().patch(item).send({ title: 'A' }),
      await http().delete(item),
    ];
    for (const response of responses) {
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ status: 'FORBIDDEN' });
    }
  });

  it('responde 401 sem sessão em todas as rotas', async () => {
    await http().get(list).expect(401);
    await http().post(list).send(goalBody()).expect(401);
    await http().patch(item).send({ title: 'A' }).expect(401);
    await http().delete(item).expect(401);
  });

  it.each([
    ['sem critério de medida', { ...goalBody(), measureCriterion: ' ' }],
    ['data-alvo após a revisão', { ...goalBody(), targetDate: '2027-04-01' }],
    ['prazo inválido', { ...goalBody(), term: 'x' }],
  ])('responde 400 VALIDATION_ERROR: %s', async (_name, body) => {
    signIn([memberId]);

    const response = await http().post(list).send(body).expect(400);

    expect(response.body).toMatchObject({ status: 'VALIDATION_ERROR' });
    expect(repo.created).toHaveLength(0);
  });

  it('responde 400 com id que não é UUID', async () => {
    signIn([memberId]);

    await http().get('/pts/x/goals').expect(400);
    const response = await http().delete(`${list}/x`).expect(400);
    expect(response.body).toEqual({
      status: 'VALIDATION_ERROR',
      message: 'Parâmetro inválido: goalId',
    });
  });

  it('responde 403 para profissional fora da equipe', async () => {
    signIn(['99999999-9999-4999-8999-999999999999']);

    await http().get(list).expect(403);
    await http().post(list).send(goalBody()).expect(403);
  });

  it('responde 404 GOAL_NOT_FOUND', async () => {
    signIn([memberId]);

    const response = await http()
      .patch(`${list}/44444444-4444-4444-8444-444444444444`)
      .send({ title: 'A' })
      .expect(404);
    expect(response.body).toMatchObject({ status: 'GOAL_NOT_FOUND' });
  });

  it('responde 409 PTS_NOT_EDITABLE com o PTS encerrado', async () => {
    signIn([memberId]);
    repo.pts[0].status = PtsStateEnum.CONCLUDED;

    const response = await http().post(list).send(goalBody()).expect(409);
    expect(response.body).toMatchObject({ status: 'PTS_NOT_EDITABLE' });
  });

  it('responde 409 GOAL_HAS_ACTIVITIES e 409 LAST_GOAL', async () => {
    signIn([memberId]);
    repo.goals[0].activitiesCount = 1;

    const linked = await http().delete(item).expect(409);
    expect(linked.body).toMatchObject({ status: 'GOAL_HAS_ACTIVITIES' });

    repo.goals[0].activitiesCount = 0;
    repo.goals[1].deleted = true;
    const last = await http().delete(item).expect(409);
    expect(last.body).toEqual({
      status: 'LAST_GOAL',
      message: 'O PTS precisa ter ao menos uma meta.',
    });
  });
});
