/*
- RFPTS010 pela rota HTTP, com o AuthGuard e o PtsService reais. SuperTokens e
  repositório são trocados por dublês.
 */
import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';
import request from 'supertest';
import { createValidationPipe } from '../src/common/validation/create-validation-pipe';
import { PtsStateEnum } from '../src/database/enums/pts-state.enum';
import type { ClosePtsInput } from '../src/pts/repositories/pts.repository';

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

describe('encerrar PTS (e2e - RFPTS010)', () => {
  const ptsId = '3f2c9a1e-7b4d-4c8e-9f1a-2b3c4d5e6f70';
  const responsibleId = '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
  const memberId = '11111111-1111-4111-8111-111111111111';
  const route = `/pts/${ptsId}/close`;
  const body = { outcome: 'cancelled', closingDate: '2026-12-10' };

  let app: INestApplication;
  let ptsExists: boolean;
  let status: PtsStateEnum;
  let closePts: jest.Mock<(input: ClosePtsInput) => Promise<unknown>>;

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

  const post = (payload: object = body, path = route) =>
    request(app.getHttpServer()).post(path).send(payload);

  beforeEach(async () => {
    ptsExists = true;
    status = PtsStateEnum.RUNNING;
    closePts = jest.fn(
      async ({ ptsId: id, outcome, closingDate, closingReason }) => {
        status = outcome as PtsStateEnum;

        return { id, status: outcome, closingDate, closingReason };
      },
    );

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
            closePts,
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
  ])('%s encerra e recebe 200', async (_label, payload, author) => {
    signIn(payload);

    const response = await post({ ...body, reason: 'Mudou de cidade.' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: ptsId,
      status: 'cancelled',
      closingDate: '2026-12-10',
      closingReason: 'Mudou de cidade.',
    });
    expect(closePts).toHaveBeenCalledWith(
      expect.objectContaining({
        authorProfessionalId: author,
        executedByAccountId: payload.accountId,
        description: 'Ana Souza cancelou o PTS (Mudou de cidade.)',
      }),
    );
  });

  it('aceita sem motivo e não encerra de novo', async () => {
    signIn({ professionalProfileIds: [responsibleId] });

    expect((await post()).body).toMatchObject({ closingReason: null });
    const again = await post();

    expect(again.status).toBe(409);
    expect(again.body).toEqual({
      status: 'PTS_NOT_ACTIVE',
      message: 'Só um PTS em planejamento ou em andamento pode ser encerrado.',
    });
    expect(closePts).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['membro da equipe', { professionalProfileIds: [memberId] }],
    ['paciente', { patientProfileId: 'account-1' }],
  ])('responde 403 para %s', async (_label, payload) => {
    signIn(payload);

    expect((await post()).body).toEqual({
      status: 'FORBIDDEN',
      message: 'Somente o responsável pode encerrar o PTS.',
    });
    expect(closePts).not.toHaveBeenCalled();
  });

  it('responde 400 com corpo ou id inválido, 404 e 401', async () => {
    await post().expect(401);

    signIn({ role: 'admin' });
    await post({ ...body, outcome: 'x' }).expect(400);
    await post({ outcome: 'concluded' }).expect(400);
    await post(body, '/pts/abc/close').expect(400);

    ptsExists = false;
    expect((await post().expect(404)).body).toMatchObject({
      status: 'PTS_NOT_FOUND',
    });
  });
});
