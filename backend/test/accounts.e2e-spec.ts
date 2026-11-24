/*
 * Este teste cobre o fluxo HTTP da desativação de conta (RFAUT005): o
 * DELETE /me e o DELETE /accounts/:id, com o AuthGuard e o AdminGuard reais, o
 * ValidationPipe global e o AccountsService real. O SuperTokens e o banco são
 * trocados por dublês.
 */
import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Request, Response } from 'express';
import request from 'supertest';
import Session from 'supertokens-node/recipe/session';
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

let AccountsController: (typeof import('../src/accounts/controllers/accounts.controller.js'))['AccountsController'];
let AuthController: (typeof import('../src/auth/controllers/auth.controller.js'))['AuthController'];
let AccountsService: (typeof import('../src/accounts/services/accounts.service.js'))['AccountsService'];
let AccountsRepository: (typeof import('../src/accounts/repositories/accounts.repository.js'))['AccountsRepository'];
let AuthGuard: (typeof import('../src/auth/guards/auth.guard.js'))['AuthGuard'];
let AdminGuard: (typeof import('../src/auth/guards/admin.guard.js'))['AdminGuard'];
let Account: (typeof import('../src/accounts/entities/account.entity.js'))['Account'];

beforeAll(async () => {
  ({ AccountsController } =
    await import('../src/accounts/controllers/accounts.controller.js'));
  ({ AuthController } =
    await import('../src/auth/controllers/auth.controller.js'));
  ({ AccountsService } =
    await import('../src/accounts/services/accounts.service.js'));
  ({ AccountsRepository } =
    await import('../src/accounts/repositories/accounts.repository.js'));
  ({ AuthGuard } = await import('../src/auth/guards/auth.guard.js'));
  ({ AdminGuard } = await import('../src/auth/guards/admin.guard.js'));
  ({ Account } = await import('../src/accounts/entities/account.entity.js'));
});

describe('account deactivation (e2e)', () => {
  const targetId = '0b6f5a4e-2c1d-4e8f-9a7b-3c2d1e0f9a8b';
  const adminId = '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
  const deactivatedAt = new Date('2026-11-10T15:00:00.000Z');

  let app: INestApplication;
  let accountRepository: {
    exists: jest.Mock<(options: unknown) => Promise<boolean>>;
  };
  let accountsRepository: {
    deactivate: jest.Mock<
      (accountId: string, executedBy: string) => Promise<unknown>
    >;
  };
  let revokeAllSessions: jest.SpiedFunction<
    (typeof Session)['revokeAllSessionsForUser']
  >;

  function signIn(accountId: string, role: 'admin' | 'user') {
    currentSession = {
      getAccessTokenPayload: () => ({
        accountId,
        role,
        patientProfileId: null,
        professionalProfileIds: [],
      }),
    };
  }

  beforeEach(async () => {
    accountRepository = { exists: jest.fn(async () => true) };
    accountsRepository = { deactivate: jest.fn() };
    revokeAllSessions = jest
      .spyOn(Session, 'revokeAllSessionsForUser')
      .mockResolvedValue([]);

    const moduleRef = await Test.createTestingModule({
      controllers: [AccountsController, AuthController],
      providers: [
        AccountsService,
        AuthGuard,
        AdminGuard,
        { provide: AccountsRepository, useValue: accountsRepository },
        { provide: getRepositoryToken(Account), useValue: accountRepository },
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

  it('lets the holder deactivate the own account and revokes the sessions', async () => {
    signIn(targetId, 'user');
    accountsRepository.deactivate.mockResolvedValue({
      outcome: 'deactivated',
      supertokensUserId: 'st-1',
      deactivatedAt,
    });

    const response = await request(app.getHttpServer()).delete('/me');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: targetId,
      status: 'inactive',
      deactivatedAt: '2026-11-10T15:00:00.000Z',
    });
    expect(accountsRepository.deactivate).toHaveBeenCalledWith(
      targetId,
      targetId,
    );
    expect(revokeAllSessions).toHaveBeenCalledWith('st-1');
  });

  it('lets the admin deactivate any account', async () => {
    signIn(adminId, 'admin');
    accountsRepository.deactivate.mockResolvedValue({
      outcome: 'deactivated',
      supertokensUserId: 'st-1',
      deactivatedAt,
    });

    const response = await request(app.getHttpServer()).delete(
      `/accounts/${targetId}`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: targetId, status: 'inactive' });
    expect(accountsRepository.deactivate).toHaveBeenCalledWith(
      targetId,
      adminId,
    );
  });

  it('answers 401 without a session', async () => {
    const response = await request(app.getHttpServer()).delete('/me');

    expect(response.status).toBe(401);
    expect(accountsRepository.deactivate).not.toHaveBeenCalled();
  });

  it('answers 401 when the session belongs to an already deactivated account', async () => {
    signIn(targetId, 'user');
    accountRepository.exists.mockResolvedValue(false);

    const response = await request(app.getHttpServer()).delete('/me');

    expect(response.status).toBe(401);
    expect(accountsRepository.deactivate).not.toHaveBeenCalled();
  });

  it('answers 403 FORBIDDEN to a user on DELETE /accounts/:id', async () => {
    signIn(targetId, 'user');

    const response = await request(app.getHttpServer()).delete(
      `/accounts/${targetId}`,
    );

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      status: 'FORBIDDEN',
      message: 'Acesso restrito ao administrador.',
    });
    expect(accountsRepository.deactivate).not.toHaveBeenCalled();
  });

  it('answers 400 for an id that is not a UUID', async () => {
    signIn(adminId, 'admin');

    const response = await request(app.getHttpServer()).delete(
      '/accounts/not-a-uuid',
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 'VALIDATION_ERROR',
      message: 'Parâmetro inválido: id',
    });
  });

  it('answers 404 ACCOUNT_NOT_FOUND for a missing account', async () => {
    signIn(adminId, 'admin');
    accountsRepository.deactivate.mockResolvedValue({ outcome: 'not_found' });

    const response = await request(app.getHttpServer()).delete(
      `/accounts/${targetId}`,
    );

    expect(response.status).toBe(404);
    expect(response.body.status).toBe('ACCOUNT_NOT_FOUND');
  });

  it('answers 409 ACCOUNT_ALREADY_DEACTIVATED', async () => {
    signIn(adminId, 'admin');
    accountsRepository.deactivate.mockResolvedValue({
      outcome: 'already_deactivated',
    });

    const response = await request(app.getHttpServer()).delete(
      `/accounts/${targetId}`,
    );

    expect(response.status).toBe(409);
    expect(response.body.status).toBe('ACCOUNT_ALREADY_DEACTIVATED');
    expect(revokeAllSessions).not.toHaveBeenCalled();
  });

  it('answers 409 ACCOUNT_IS_PTS_RESPONSIBLE and keeps the sessions', async () => {
    signIn(targetId, 'user');
    accountsRepository.deactivate.mockResolvedValue({
      outcome: 'pts_responsible',
    });

    const response = await request(app.getHttpServer()).delete('/me');

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      status: 'ACCOUNT_IS_PTS_RESPONSIBLE',
      message:
        'A conta tem perfil responsável por um PTS ativo. Transfira a responsabilidade antes de desativar.',
    });
    expect(revokeAllSessions).not.toHaveBeenCalled();
  });
});
