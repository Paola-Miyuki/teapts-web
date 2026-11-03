/*
 * Este teste cobre o fluxo HTTP do cadastro de perfil profissional (RFPRO002):
 * o POST /professionals, com o AuthGuard e o AdminGuard reais, o
 * ValidationPipe global e o service real. O SuperTokens e o banco são
 * trocados por dublês.
 */
import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Request, Response } from 'express';
import request from 'supertest';
import { QueryFailedError } from 'typeorm';
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
let ProfessionalsController: (typeof import('../src/professionals/controllers/professionals.controller.js'))['ProfessionalsController'];
let ProfessionalsService: (typeof import('../src/professionals/services/professionals.service.js'))['ProfessionalsService'];
let ProfessionalsRepository: (typeof import('../src/professionals/repositories/professionals.repository.js'))['ProfessionalsRepository'];
let AuthGuard: (typeof import('../src/auth/guards/auth.guard.js'))['AuthGuard'];
let AdminGuard: (typeof import('../src/auth/guards/admin.guard.js'))['AdminGuard'];
let Account: (typeof import('../src/accounts/entities/account.entity.js'))['Account'];

beforeAll(async () => {
  ({ ProfessionalsController } =
    await import('../src/professionals/controllers/professionals.controller.js'));
  ({ ProfessionalsService } =
    await import('../src/professionals/services/professionals.service.js'));
  ({ ProfessionalsRepository } =
    await import('../src/professionals/repositories/professionals.repository.js'));
  ({ AuthGuard } = await import('../src/auth/guards/auth.guard.js'));
  ({ AdminGuard } = await import('../src/auth/guards/admin.guard.js'));
  ({ Account } = await import('../src/accounts/entities/account.entity.js'));
});

describe('professional profile (e2e)', () => {
  const accountId = '0b6f5a4e-2c1d-4e8f-9a7b-3c2d1e0f9a8b';
  const professionalId = '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
  const body = { accountId, specialism: 'psychologist' };
  const userAccount = {
    id: accountId,
    name: 'Kaio Felipe',
    email: 'kaio@exemplo.com',
    role: 'user',
    patientProfile: null,
    professionalProfiles: [],
  };

  let app: INestApplication;
  let accountRepository: {
    findOne: jest.Mock<(options: unknown) => Promise<unknown>>;
  };
  let professionalsRepository: {
    insert: jest.Mock<(professional: unknown) => Promise<string>>;
  };

  function signIn(role: 'admin' | 'user') {
    currentSession = {
      getAccessTokenPayload: () => ({
        accountId: 'admin-account',
        role,
        patientProfileId: null,
        professionalProfileIds: [],
      }),
    };
  }

  beforeEach(async () => {
    accountRepository = { findOne: jest.fn() };
    professionalsRepository = { insert: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [ProfessionalsController],
      providers: [
        ProfessionalsService,
        AuthGuard,
        AdminGuard,
        { provide: ProfessionalsRepository, useValue: professionalsRepository },
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

  it('creates the professional profile and answers 201', async () => {
    signIn('admin');
    accountRepository.findOne.mockResolvedValue(userAccount);
    professionalsRepository.insert.mockResolvedValue(professionalId);

    const response = await request(app.getHttpServer())
      .post('/professionals')
      .send(body);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: professionalId,
      accountId,
      name: 'Kaio Felipe',
      email: 'kaio@exemplo.com',
      specialism: { id: 'psychologist', name: 'Psicologia' },
      deactivatedAt: null,
    });
    expect(professionalsRepository.insert).toHaveBeenCalledWith(body);
  });

  it('creates another specialism for an account that is already a professional', async () => {
    signIn('admin');
    accountRepository.findOne.mockResolvedValue({
      ...userAccount,
      professionalProfiles: [{ accountId, specialism: 'doctor' }],
    });
    professionalsRepository.insert.mockResolvedValue(professionalId);

    const response = await request(app.getHttpServer())
      .post('/professionals')
      .send(body);

    expect(response.status).toBe(201);
    expect(response.body.specialism).toEqual({
      id: 'psychologist',
      name: 'Psicologia',
    });
  });

  it('answers 401 without a session', async () => {
    const response = await request(app.getHttpServer())
      .post('/professionals')
      .send(body);

    expect(response.status).toBe(401);
    expect(professionalsRepository.insert).not.toHaveBeenCalled();
  });

  it('answers 403 FORBIDDEN to a user who is not an admin', async () => {
    signIn('user');

    const response = await request(app.getHttpServer())
      .post('/professionals')
      .send(body);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      status: 'FORBIDDEN',
      message: 'Acesso restrito ao administrador.',
    });
    expect(accountRepository.findOne).not.toHaveBeenCalled();
  });

  it('answers 400 VALIDATION_ERROR for an invalid specialism', async () => {
    signIn('admin');

    const response = await request(app.getHttpServer())
      .post('/professionals')
      .send({ accountId, specialism: 'nurse' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 'VALIDATION_ERROR',
      message: 'Informe uma especialidade válida.',
    });
    expect(accountRepository.findOne).not.toHaveBeenCalled();
  });

  it('answers 404 ACCOUNT_NOT_FOUND for a missing account', async () => {
    signIn('admin');
    accountRepository.findOne.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .post('/professionals')
      .send(body);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      status: 'ACCOUNT_NOT_FOUND',
      message: 'Conta não encontrada.',
    });
    expect(professionalsRepository.insert).not.toHaveBeenCalled();
  });

  it.each([
    [
      'an admin account',
      { role: 'admin' },
      {
        status: 'ADMIN_ACCOUNT_NOT_ALLOWED',
        message: 'Conta de administrador não pode ter perfil profissional.',
      },
    ],
    [
      'an account with a patient profile',
      { patientProfile: { accountId, supportContacts: [] } },
      {
        status: 'ACCOUNT_HAS_PATIENT_PROFILE',
        message: 'A conta já possui um perfil de paciente.',
      },
    ],
    [
      'the same specialism on the account',
      { professionalProfiles: [{ accountId, specialism: 'psychologist' }] },
      {
        status: 'PROFESSIONAL_PROFILE_ALREADY_EXISTS',
        message:
          'A conta já possui um perfil profissional com essa especialidade.',
      },
    ],
  ])('answers 409 for %s', async (_case, account, error) => {
    signIn('admin');
    accountRepository.findOne.mockResolvedValue({ ...userAccount, ...account });

    const response = await request(app.getHttpServer())
      .post('/professionals')
      .send(body);

    expect(response.status).toBe(409);
    expect(response.body).toEqual(error);
    expect(professionalsRepository.insert).not.toHaveBeenCalled();
  });

  it('answers 409 when a simultaneous request created the profile first', async () => {
    signIn('admin');
    accountRepository.findOne.mockResolvedValue(userAccount);
    professionalsRepository.insert.mockRejectedValue(
      new QueryFailedError(
        'INSERT INTO "professional"',
        [],
        Object.assign(new Error('duplicate key value'), { code: '23505' }),
      ),
    );

    const response = await request(app.getHttpServer())
      .post('/professionals')
      .send(body);

    expect(response.status).toBe(409);
    expect(response.body.status).toBe('PROFESSIONAL_PROFILE_ALREADY_EXISTS');
  });
});
