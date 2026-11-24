/*
- RFPTS006 pela rota HTTP, com o AuthGuard e o PtsService reais. SuperTokens e
  repositório são trocados por dublês.
 */
import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';
import request from 'supertest';
import { createValidationPipe } from '../src/common/validation/create-validation-pipe';
import { PtsStateEnum } from '../src/database/enums/pts-state.enum';
import type { StartPtsInput } from '../src/pts/repositories/pts.repository';

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
let PtsService: (typeof import('../src/pts/services/pts.service.js'))['PtsService'];
let PtsRepository: (typeof import('../src/pts/repositories/pts.repository.js'))['PtsRepository'];
let AccountsService: (typeof import('../src/accounts/services/accounts.service.js'))['AccountsService'];
let AuthGuard: (typeof import('../src/auth/guards/auth.guard.js'))['AuthGuard'];

beforeAll(async () => {
  ({ PtsController } =
    await import('../src/pts/controllers/pts.controller.js'));
  ({ PtsService } = await import('../src/pts/services/pts.service.js'));
  ({ PtsRepository } =
    await import('../src/pts/repositories/pts.repository.js'));
  ({ AccountsService } =
    await import('../src/accounts/services/accounts.service.js'));
  ({ AuthGuard } = await import('../src/auth/guards/auth.guard.js'));
});

describe('início da execução do PTS (e2e - RFPTS006)', () => {
  const ptsId = '3f2c9a1e-7b4d-4c8e-9f1a-2b3c4d5e6f70';
  const responsibleId = '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
  const memberId = '11111111-1111-4111-8111-111111111111';
  const route = `/pts/${ptsId}/start`;
  const beganAt = '2026-12-01T13:00:00.000Z';

  let app: INestApplication;
  let ptsExists: boolean;
  let status: PtsStateEnum;
  let startPts: jest.Mock<(input: StartPtsInput) => Promise<unknown>>;

  function signIn(payload: Record<string, unknown>) {
    currentSession = {
      getAccessTokenPayload: () => ({
        accountId: 'account-1',
        role: 'user',
        patientProfileId: null,
        professionalProfileIds: [],
        ...payload,
      }),
    };
  }

  const post = (path = route) => request(app.getHttpServer()).post(path);

  beforeEach(async () => {
    ptsExists = true;
    status = PtsStateEnum.PLANNING;
    startPts = jest.fn(async () => {
      status = PtsStateEnum.RUNNING;

      return { id: ptsId, status, beganAt };
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [PtsController],
      providers: [
        PtsService,
        AuthGuard,
        // O AuthGuard consulta a situação da conta (RFAUT005).
        { provide: AccountsService, useValue: { isActive: async () => true } },
        {
          provide: PtsRepository,
          useValue: {
            findPtsTeamTarget: async () =>
              ptsExists
                ? {
                    id: ptsId,
                    status,
                    responsibleProfessionalId: responsibleId,
                    responsibleAccountId: 'account-responsible',
                    responsibleName: 'Ana Souza',
                    teamMembers: [
                      { professionalId: memberId, accountId: 'account-member' },
                    ],
                  }
                : null,
            findAccountDisplayName: async () => 'Ana Souza',
            startPts,
          },
        },
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

  it.each([
    [
      'o responsável',
      {
        accountId: 'account-responsible',
        professionalProfileIds: [responsibleId],
      },
      responsibleId,
    ],
    ['o admin', { accountId: 'account-admin', role: 'admin' }, null],
  ])('%s inicia e recebe 200', async (_label, payload, author) => {
    signIn(payload);

    const response = await post();

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: ptsId, status: 'running', beganAt });
    expect(startPts).toHaveBeenCalledWith({
      ptsId,
      authorProfessionalId: author,
      executedByAccountId: payload.accountId,
      description: 'Ana Souza iniciou a execução do PTS',
    });
  });

  it('responde 409 PTS_NOT_PLANNING ao iniciar de novo', async () => {
    signIn({ professionalProfileIds: [responsibleId] });

    await post();
    const response = await post();

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      status: 'PTS_NOT_PLANNING',
      message: 'Só um PTS em planejamento pode ter a execução iniciada.',
    });
    expect(startPts).toHaveBeenCalledTimes(1);
  });

  it.each([
    PtsStateEnum.DRAFT,
    PtsStateEnum.CONCLUDED,
    PtsStateEnum.CANCELLED,
    PtsStateEnum.REJECTED,
  ])('responde 409 PTS_NOT_PLANNING para PTS em %s', async (current) => {
    signIn({ role: 'admin' });
    status = current;

    const response = await post();

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ status: 'PTS_NOT_PLANNING' });
    expect(startPts).not.toHaveBeenCalled();
  });

  it.each([
    ['membro da equipe', { professionalProfileIds: [memberId] }],
    ['paciente', { patientProfileId: 'account-1' }],
    ['conta sem perfil', {}],
  ])('responde 403 FORBIDDEN para %s', async (_label, payload) => {
    signIn(payload);

    const response = await post();

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      status: 'FORBIDDEN',
      message: 'Somente o responsável pode iniciar a execução do PTS.',
    });
    expect(startPts).not.toHaveBeenCalled();
  });

  it('responde 404 PTS_NOT_FOUND quando o PTS não existe', async () => {
    signIn({ role: 'admin' });
    ptsExists = false;

    const response = await post();

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ status: 'PTS_NOT_FOUND' });
  });

  it('responde 400 VALIDATION_ERROR quando o id não é UUID', async () => {
    signIn({ role: 'admin' });

    const response = await post('/pts/abc/start');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ status: 'VALIDATION_ERROR' });
  });

  it('responde 401 sem sessão', async () => {
    const response = await post();

    expect(response.status).toBe(401);
    expect(startPts).not.toHaveBeenCalled();
  });
});
