/*
 * Este teste cobre o fluxo HTTP da exclusão de proposta de PTS (RFPTS008):
 * DELETE /pts/proposals/:id com o AuthGuard real, o ValidationPipe global e
 * o PtsService real, e confere que a proposta excluída some de
 * GET /pts/proposals/:id. O SuperTokens e o repositório são trocados por
 * dublês.
 */
import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';
import request from 'supertest';
import { createValidationPipe } from '../src/common/validation/create-validation-pipe';

type SessionMiddleware = (
  request: Request,
  response: Response,
  next: (error?: unknown) => void,
) => Promise<void>;

// Sessão que o verifySession mockado anexa à requisição; sem ela, o
// AuthGuard responde 401 porque o payload da sessão é inválido.
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

// Sob ESM os mocks de módulo não são içados: o código da aplicação é
// importado depois, com import dinâmico (`.js` mapeado para `.ts`).
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

describe('excluir proposta de PTS (e2e)', () => {
  const proposalId = '3f2e1d0c-9b8a-4765-a432-10fedcba9876';
  const responsibleId = '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
  const outsiderId = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
  const route = `/pts/proposals/${proposalId}`;

  let app: INestApplication;
  let deleted: boolean;
  let status: string;
  let ptsRepository: {
    findProposalById: jest.Mock<(id: string) => Promise<unknown>>;
    findDraftProposalById: jest.Mock<(id: string) => Promise<unknown>>;
    softDeleteProposal: jest.Mock<(id: string) => Promise<void>>;
  };

  function signIn(professionalProfileIds: string[]) {
    currentSession = {
      getAccessTokenPayload: () => ({
        accountId: 'account-1',
        role: 'user',
        patientProfileId: null,
        professionalProfileIds,
      }),
    };
  }

  // Dublê que imita o TypeORM: com deletedAt, a proposta some das consultas.
  function proposal() {
    if (deleted) {
      return null;
    }

    return {
      id: proposalId,
      status,
      socialSituation: 'Mora com a mãe.',
      createdAt: '2026-10-15T12:00:00.000Z',
      patient: { id: 'patient-1', name: 'Priscila Martins' },
      responsible: {
        id: responsibleId,
        name: 'Kaio Segunda Conta',
        specialism: { id: 'psychologist', name: 'Psicologia' },
      },
      team: [],
    };
  }

  beforeEach(async () => {
    deleted = false;
    status = 'draft';
    ptsRepository = {
      findProposalById: jest.fn(async () => proposal()),
      findDraftProposalById: jest.fn(async () =>
        status === 'draft' ? proposal() : null,
      ),
      softDeleteProposal: jest.fn(async () => {
        deleted = true;
      }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [PtsController],
      providers: [
        PtsService,
        AuthGuard,
        // O AuthGuard consulta a situação da conta (RFAUT005).
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

  it('exclui a proposta, responde { status: OK } e ela some do GET', async () => {
    signIn([responsibleId]);

    const response = await request(app.getHttpServer()).delete(route);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'OK' });
    expect(ptsRepository.softDeleteProposal).toHaveBeenCalledWith(proposalId);

    const consult = await request(app.getHttpServer()).get(route);

    expect(consult.status).toBe(404);
    expect(consult.body).toMatchObject({ status: 'PTS_NOT_FOUND' });
  });

  it('responde 404 ao excluir de novo', async () => {
    signIn([responsibleId]);
    await request(app.getHttpServer()).delete(route);

    const response = await request(app.getHttpServer()).delete(route);

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ status: 'PTS_NOT_FOUND' });
  });

  it('responde 401 sem sessão', async () => {
    const response = await request(app.getHttpServer()).delete(route);

    expect(response.status).toBe(401);
    expect(ptsRepository.findProposalById).not.toHaveBeenCalled();
  });

  it('responde 400 VALIDATION_ERROR quando o id não é UUID', async () => {
    signIn([responsibleId]);

    const response = await request(app.getHttpServer()).delete(
      '/pts/proposals/nao-e-uuid',
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 'VALIDATION_ERROR',
      message: 'Parâmetro inválido: id',
    });
  });

  it('responde 403 a outro profissional', async () => {
    signIn([outsiderId]);

    const response = await request(app.getHttpServer()).delete(route);

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ status: 'FORBIDDEN' });
    expect(ptsRepository.softDeleteProposal).not.toHaveBeenCalled();
  });

  it('responde 409 PTS_NOT_DRAFT para proposta já aprovada', async () => {
    signIn([responsibleId]);
    status = 'planning';

    const response = await request(app.getHttpServer()).delete(route);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      status: 'PTS_NOT_DRAFT',
      message: 'Somente propostas aguardando decisão podem ser excluídas.',
    });
    expect(ptsRepository.softDeleteProposal).not.toHaveBeenCalled();
  });
});
