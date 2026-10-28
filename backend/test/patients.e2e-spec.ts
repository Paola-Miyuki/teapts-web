/*
 * Este teste cobre o fluxo HTTP do cadastro de perfil de paciente (RFPAC001):
 * a listagem de contas sem perfil de paciente e o POST /patients, com o
 * AuthGuard e o AdminGuard reais, o ValidationPipe global e os services
 * reais. O SuperTokens e o banco são trocados por dublês.
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
let PatientsController: (typeof import('../src/patients/controllers/patients.controller.js'))['PatientsController'];
let PatientsService: (typeof import('../src/patients/services/patients.service.js'))['PatientsService'];
let PatientsRepository: (typeof import('../src/patients/repositories/patients.repository.js'))['PatientsRepository'];
let AccountsController: (typeof import('../src/accounts/controllers/accounts.controller.js'))['AccountsController'];
let AccountsService: (typeof import('../src/accounts/services/accounts.service.js'))['AccountsService'];
let AccountsRepository: (typeof import('../src/accounts/repositories/accounts.repository.js'))['AccountsRepository'];
let AuthGuard: (typeof import('../src/auth/guards/auth.guard.js'))['AuthGuard'];
let AdminGuard: (typeof import('../src/auth/guards/admin.guard.js'))['AdminGuard'];
let Account: (typeof import('../src/accounts/entities/account.entity.js'))['Account'];

beforeAll(async () => {
  ({ PatientsController } =
    await import('../src/patients/controllers/patients.controller.js'));
  ({ PatientsService } =
    await import('../src/patients/services/patients.service.js'));
  ({ PatientsRepository } =
    await import('../src/patients/repositories/patients.repository.js'));
  ({ AccountsController } =
    await import('../src/accounts/controllers/accounts.controller.js'));
  ({ AccountsService } =
    await import('../src/accounts/services/accounts.service.js'));
  ({ AccountsRepository } =
    await import('../src/accounts/repositories/accounts.repository.js'));
  ({ AuthGuard } = await import('../src/auth/guards/auth.guard.js'));
  ({ AdminGuard } = await import('../src/auth/guards/admin.guard.js'));
  ({ Account } = await import('../src/accounts/entities/account.entity.js'));
});

describe('patient profile (e2e)', () => {
  const accountId = '0b6f5a4e-2c1d-4e8f-9a7b-3c2d1e0f9a8b';
  const body = {
    accountId,
    supportContacts: [
      {
        name: 'Maria Martins',
        description: 'Mãe',
        email: 'maria@exemplo.com',
        phone: '(11) 98765-4321',
      },
    ],
  };

  let app: INestApplication;
  let accountRepository: {
    findOne: jest.Mock<(options: unknown) => Promise<unknown>>;
  };
  let patientsRepository: {
    insert: jest.Mock<(patient: unknown) => Promise<void>>;
  };
  let accountsRepository: {
    findPaginated: jest.Mock<(filters: unknown) => Promise<unknown>>;
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
    patientsRepository = { insert: jest.fn() };
    accountsRepository = { findPaginated: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [PatientsController, AccountsController],
      providers: [
        PatientsService,
        AccountsService,
        AuthGuard,
        AdminGuard,
        { provide: PatientsRepository, useValue: patientsRepository },
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

  it('lists the accounts without a patient profile to an admin', async () => {
    signIn('admin');
    accountsRepository.findPaginated.mockResolvedValue({
      rows: [{ account_id: accountId, account_name: 'João Martins' }],
      total: 1,
    });

    const response = await request(app.getHttpServer())
      .get('/accounts')
      .query({ isPatient: 'false', page: 1, limit: 20 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [{ id: accountId, name: 'João Martins' }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect(accountsRepository.findPaginated).toHaveBeenCalledWith(
      expect.objectContaining({ isPatient: false, page: 1, limit: 20 }),
    );
  });

  it('creates the patient profile and answers 201', async () => {
    signIn('admin');
    accountRepository.findOne.mockResolvedValue({
      id: accountId,
      patientProfile: null,
    });
    patientsRepository.insert.mockResolvedValue(undefined);

    const response = await request(app.getHttpServer())
      .post('/patients')
      .send(body);

    expect(response.status).toBe(201);
    expect(response.body).toEqual(body);
    expect(patientsRepository.insert).toHaveBeenCalledWith(body);
  });

  it('answers 401 without a session', async () => {
    const response = await request(app.getHttpServer())
      .post('/patients')
      .send(body);

    expect(response.status).toBe(401);
    expect(patientsRepository.insert).not.toHaveBeenCalled();
  });

  it.each([
    ['post', '/patients'],
    ['get', '/accounts'],
  ] as const)(
    'answers 403 FORBIDDEN to a user on %s %s',
    async (method, path) => {
      signIn('user');

      const response = await request(app.getHttpServer())
        [method](path)
        .send(method === 'post' ? body : undefined);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        status: 'FORBIDDEN',
        message: 'Acesso restrito ao administrador.',
      });
    },
  );

  it('answers 400 VALIDATION_ERROR for an invalid body', async () => {
    signIn('admin');

    const response = await request(app.getHttpServer())
      .post('/patients')
      .send({ accountId, supportContacts: [{ name: 'Maria', email: 'x' }] });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 'VALIDATION_ERROR',
      message: 'Informe um e-mail válido para o contato.',
    });
    expect(accountRepository.findOne).not.toHaveBeenCalled();
  });

  it('answers 404 ACCOUNT_NOT_FOUND for a missing account', async () => {
    signIn('admin');
    accountRepository.findOne.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .post('/patients')
      .send({ accountId });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      status: 'ACCOUNT_NOT_FOUND',
      message: 'Conta não encontrada.',
    });
  });

  it('answers 409 when the account already has a patient profile', async () => {
    signIn('admin');
    accountRepository.findOne.mockResolvedValue({
      id: accountId,
      patientProfile: { accountId, supportContacts: [] },
    });

    const response = await request(app.getHttpServer())
      .post('/patients')
      .send({ accountId });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      status: 'PATIENT_PROFILE_ALREADY_EXISTS',
      message: 'A conta já possui perfil de paciente.',
    });
    expect(patientsRepository.insert).not.toHaveBeenCalled();
  });

  it('answers 409 when a simultaneous request created the profile first', async () => {
    signIn('admin');
    accountRepository.findOne.mockResolvedValue({ id: accountId });
    patientsRepository.insert.mockRejectedValue(
      new QueryFailedError(
        'INSERT INTO "patient"',
        [],
        Object.assign(new Error('duplicate key value'), { code: '23505' }),
      ),
    );

    const response = await request(app.getHttpServer())
      .post('/patients')
      .send({ accountId });

    expect(response.status).toBe(409);
    expect(response.body.status).toBe('PATIENT_PROFILE_ALREADY_EXISTS');
  });
});
