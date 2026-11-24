/*
- Este teste cobre o fluxo HTTP da ficha do PTS (RFPTS005) com o AuthGuard
- real, o ValidationPipe global e o PtsService real. SuperTokens e repositório
- são trocados por dublês.
 */
import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';
import request from 'supertest';
import { createValidationPipe } from '../src/common/validation/create-validation-pipe';
import { PtsStateEnum } from '../src/database/enums/pts-state.enum';
import type {
  PtsSheetTarget,
  UpdatePtsSheetInput,
} from '../src/pts/repositories/pts.repository';

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

describe('ficha do PTS (e2e - RFPTS005)', () => {
  const ptsId = '3f2e1d0c-9b8a-4765-a432-10fedcba9876';
  const responsibleId = '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
  const memberId = '11111111-1111-4111-8111-111111111111';
  const route = `/pts/${ptsId}/sheet`;
  const body = {
    caseStudyDate: '2026-10-01',
    diagnosisSummary: '  Diagnóstico em comum.  ',
    cid: 'F84.0',
    supportLevel: 2,
    priorityNeeds: ['Comunicação'],
    socialSituation: 'Mora com a mãe e a avó.',
    nextReviewAt: '2027-10-01',
  };

  let app: INestApplication;
  let target: PtsSheetTarget | null;
  let ptsRepository: {
    findSheetTarget: jest.Mock<(id: string) => Promise<PtsSheetTarget | null>>;
    updateSheet: jest.Mock<(input: UpdatePtsSheetInput) => Promise<unknown>>;
  };

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

  beforeEach(async () => {
    target = {
      id: ptsId,
      status: PtsStateEnum.RUNNING,
      responsibleProfessionalId: responsibleId,
      teamProfessionalIds: [memberId],
    };
    ptsRepository = {
      findSheetTarget: jest.fn(async () => target),
      updateSheet: jest.fn(
        async ({ ptsId: id, sheet }: UpdatePtsSheetInput) => ({
          id,
          ...sheet,
        }),
      ),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [PtsController],
      providers: [
        PtsService,
        AuthGuard,
        { provide: AccountsService, useValue: { isActive: async () => true } },
        { provide: PtsRepository, useValue: ptsRepository },
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

  it('atualiza a ficha como responsável e grava o evento com quem executou', async () => {
    signIn([responsibleId]);

    const response = await request(app.getHttpServer()).patch(route).send(body);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: ptsId,
      diagnosisSummary: 'Diagnóstico em comum.',
      cid: 'F84.0',
      supportLevel: 2,
      strengths: null,
      priorityNeeds: ['Comunicação'],
      nextReviewAt: '2027-10-01',
    });
    expect(ptsRepository.updateSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        ptsId,
        authorProfessionalId: responsibleId,
        executedByAccountId: 'account-1',
      }),
    );
  });

  it('permite ao membro da equipe e ao admin', async () => {
    signIn([memberId]);
    await request(app.getHttpServer()).patch(route).send(body).expect(200);

    signIn([], { role: 'admin' });
    await request(app.getHttpServer()).patch(route).send(body).expect(200);

    expect(ptsRepository.updateSheet).toHaveBeenLastCalledWith(
      expect.objectContaining({ authorProfessionalId: null }),
    );
  });

  it('responde 401 sem sessão', async () => {
    await request(app.getHttpServer()).patch(route).send(body).expect(401);
  });

  it.each([
    ['síntese vazia', { ...body, diagnosisSummary: '   ' }],
    ['supportLevel 4', { ...body, supportLevel: 4 }],
    ['data inválida', { ...body, nextReviewAt: '2027-13-40' }],
  ])('responde 400 VALIDATION_ERROR com %s', async (_name, payload) => {
    signIn([responsibleId]);

    const response = await request(app.getHttpServer())
      .patch(route)
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ status: 'VALIDATION_ERROR' });
    expect(ptsRepository.updateSheet).not.toHaveBeenCalled();
  });

  it('responde 403 FORBIDDEN para profissional fora da equipe e para o paciente', async () => {
    signIn(['99999999-9999-4999-8999-999999999999']);
    await request(app.getHttpServer()).patch(route).send(body).expect(403);

    signIn([], { patientProfileId: 'patient-1' });
    const response = await request(app.getHttpServer()).patch(route).send(body);

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ status: 'FORBIDDEN' });
    expect(ptsRepository.updateSheet).not.toHaveBeenCalled();
  });

  it('responde 404 PTS_NOT_FOUND quando o PTS não existe', async () => {
    signIn([responsibleId]);
    target = null;

    const response = await request(app.getHttpServer()).patch(route).send(body);

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ status: 'PTS_NOT_FOUND' });
  });

  it('responde 409 PTS_NOT_ACTIVE fora de PLANNING e RUNNING', async () => {
    signIn([responsibleId]);
    target!.status = PtsStateEnum.CONCLUDED;

    const response = await request(app.getHttpServer()).patch(route).send(body);

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ status: 'PTS_NOT_ACTIVE' });
  });

  it('a rota antiga da situação social responde 404', async () => {
    signIn([responsibleId]);

    await request(app.getHttpServer())
      .patch(`/pts/${ptsId}/social-situation`)
      .send({ socialSituation: 'x' })
      .expect(404);
  });
});
