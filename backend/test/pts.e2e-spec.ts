/*
 * Este teste cobre o fluxo HTTP da remoção de profissional da equipe
 * (RFEM003): DELETE /pts/:id/team/:professionalId com o AuthGuard real, o
 * ValidationPipe global e o PtsService real. O SuperTokens e o repositório
 * são trocados por dublês.
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

describe('remover profissional da equipe (e2e)', () => {
  const ptsId = '3f2e1d0c-9b8a-4765-a432-10fedcba9876';
  const responsibleId = '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
  const memberId = '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a';
  const outsiderId = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
  const route = `/pts/${ptsId}/team/${memberId}`;

  const responsible = {
    id: responsibleId,
    name: 'Kaio Segunda Conta',
    specialism: { id: 'psychologist', name: 'Psicologia' },
  };
  const member = {
    id: memberId,
    name: 'Ana Souza',
    specialism: { id: 'doctor', name: 'Medicina' },
  };

  let app: INestApplication;
  let ptsRepository: {
    findPtsTeam: jest.Mock<(id: string) => Promise<unknown>>;
    findAccountDisplayName: jest.Mock<(id: string) => Promise<string | null>>;
    removeTeamMember: jest.Mock<(input: unknown) => Promise<unknown>>;
  };

  function signIn(
    professionalProfileIds: string[],
    role: 'admin' | 'user' = 'user',
  ) {
    currentSession = {
      getAccessTokenPayload: () => ({
        accountId: 'account-1',
        role,
        patientProfileId: null,
        professionalProfileIds,
      }),
    };
  }

  function seedPts(status = 'running') {
    ptsRepository.findPtsTeam.mockResolvedValue({
      id: ptsId,
      status,
      responsible,
      team: [member],
    });
  }

  beforeEach(async () => {
    ptsRepository = {
      findPtsTeam: jest.fn(),
      findAccountDisplayName: jest.fn(async () => 'Kaio Segunda Conta'),
      removeTeamMember: jest.fn(),
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

  it('remove o membro, grava a timeline e responde 200 com a equipe', async () => {
    signIn([responsibleId]);
    seedPts();
    ptsRepository.removeTeamMember.mockResolvedValue({
      id: ptsId,
      status: 'running',
      responsible,
      team: [],
    });

    const response = await request(app.getHttpServer()).delete(route);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: ptsId,
      status: 'running',
      responsible,
      team: [],
    });
    expect(ptsRepository.removeTeamMember).toHaveBeenCalledWith({
      ptsId,
      professionalId: memberId,
      authorProfessionalId: responsibleId,
      executedByAccountId: expect.any(String),
      description: 'Kaio Segunda Conta removeu Ana Souza da equipe',
    });
  });

  it('responde 401 sem sessão', async () => {
    const response = await request(app.getHttpServer()).delete(route);

    expect(response.status).toBe(401);
    expect(ptsRepository.findPtsTeam).not.toHaveBeenCalled();
  });

  it('responde 400 quando o id do PTS não é UUID', async () => {
    signIn([responsibleId]);

    const response = await request(app.getHttpServer()).delete(
      `/pts/nao-e-uuid/team/${memberId}`,
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 'VALIDATION_ERROR',
      message: 'Parâmetro inválido: id',
    });
  });

  it('responde 400 quando o professionalId não é UUID', async () => {
    signIn([responsibleId]);

    const response = await request(app.getHttpServer()).delete(
      `/pts/${ptsId}/team/nao-e-uuid`,
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 'VALIDATION_ERROR',
      message: 'Parâmetro inválido: professionalId',
    });
  });

  it('responde 403 a outro profissional', async () => {
    signIn([outsiderId]);
    seedPts();

    const response = await request(app.getHttpServer()).delete(route);

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ status: 'FORBIDDEN' });
    expect(ptsRepository.removeTeamMember).not.toHaveBeenCalled();
  });

  it('responde 404 PTS_NOT_FOUND para PTS inexistente', async () => {
    signIn([responsibleId]);
    ptsRepository.findPtsTeam.mockResolvedValue(null);

    const response = await request(app.getHttpServer()).delete(route);

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ status: 'PTS_NOT_FOUND' });
  });

  it('responde 404 TEAM_MEMBER_NOT_FOUND para profissional fora da equipe', async () => {
    signIn([responsibleId]);
    seedPts();

    const response = await request(app.getHttpServer()).delete(
      `/pts/${ptsId}/team/${outsiderId}`,
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ status: 'TEAM_MEMBER_NOT_FOUND' });
  });

  it('responde 409 PTS_NOT_ACTIVE para PTS encerrado', async () => {
    signIn([responsibleId]);
    seedPts('concluded');

    const response = await request(app.getHttpServer()).delete(route);

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ status: 'PTS_NOT_ACTIVE' });
  });

  it('responde 409 CANNOT_REMOVE_RESPONSIBLE ao remover o responsável', async () => {
    signIn([responsibleId]);
    seedPts();

    const response = await request(app.getHttpServer()).delete(
      `/pts/${ptsId}/team/${responsibleId}`,
    );

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      status: 'CANNOT_REMOVE_RESPONSIBLE',
      message:
        'O responsável não pode ser removido da equipe. Transfira a responsabilidade antes.',
    });
    expect(ptsRepository.removeTeamMember).not.toHaveBeenCalled();
  });
});
