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
let AccountsService: (typeof import('../src/accounts/services/accounts.service.js'))['AccountsService'];
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
  ({ AccountsService } =
    await import('../src/accounts/services/accounts.service.js'));
  ({ AuthGuard } = await import('../src/auth/guards/auth.guard.js'));
  ({ AdminGuard } = await import('../src/auth/guards/admin.guard.js'));
  ({ Account } = await import('../src/accounts/entities/account.entity.js'));
});

describe('professional profile (e2e)', () => {
  const accountId = '0b6f5a4e-2c1d-4e8f-9a7b-3c2d1e0f9a8b';
  const professionalId = '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
  const body = {
    accountId,
    specialism: 'speech_therapist',
    councilNumber: '6789',
    councilState: 'pr',
    institution: 'CAPSi Boa Vista',
    cnes: '1234567',
  };
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
    professionalsRepository = { insert: jest.fn(), findPaginated: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [ProfessionalsController],
      providers: [
        ProfessionalsService,
        AuthGuard,
        // O AuthGuard consulta a situação da conta (RFAUT005).
        { provide: AccountsService, useValue: { isActive: async () => true } },
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
      specialism: { id: 'speech_therapist', name: 'Fonoaudiólogo' },
      registration: { council: 'CRFa', number: '6789', state: 'pr' },
      institution: 'CAPSi Boa Vista',
      cnes: '1234567',
      deactivatedAt: null,
    });
    // O criador é o admin da sessão.
    expect(professionalsRepository.insert).toHaveBeenCalledWith({
      ...body,
      createdByAccountId: 'admin-account',
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

  it.each([
    [
      'an invalid specialism',
      { specialism: 'astronaut' },
      'Informe uma especialidade válida.',
    ],
    [
      'a missing council number',
      { councilNumber: undefined },
      'Informe o número do registro.',
    ],
    [
      'a blank council number',
      { councilNumber: '  ' },
      'Informe o número do registro.',
    ],
    [
      'a missing council state',
      { councilState: undefined },
      'Informe uma UF válida.',
    ],
    [
      'an invalid council state',
      { councilState: 'xx' },
      'Informe uma UF válida.',
    ],
    [
      'a CNES outside 7 digits',
      { cnes: '12345' },
      'O CNES deve ter 7 dígitos.',
    ],
  ])(
    'answers 400 VALIDATION_ERROR for %s, without creating the profile',
    async (_case, change, message) => {
      signIn('admin');

      const response = await request(app.getHttpServer())
        .post('/professionals')
        .send({ ...body, ...change });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ status: 'VALIDATION_ERROR', message });
      expect(accountRepository.findOne).not.toHaveBeenCalled();
      expect(professionalsRepository.insert).not.toHaveBeenCalled();
    },
  );

  it('creates the profile without the optional institution and CNES', async () => {
    signIn('admin');
    accountRepository.findOne.mockResolvedValue(userAccount);
    professionalsRepository.insert.mockResolvedValue(professionalId);
    const { institution, cnes, ...required } = body;
    void institution;
    void cnes;

    const response = await request(app.getHttpServer())
      .post('/professionals')
      .send(required);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ institution: null, cnes: null });
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
      'an account that already has a professional profile',
      { professionalProfiles: [{ accountId, specialism: 'doctor' }] },
      {
        status: 'PROFESSIONAL_PROFILE_ALREADY_EXISTS',
        message: 'A conta já possui um perfil profissional.',
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

  it('returns the council registration, institution and CNES in GET /professionals', async () => {
    signIn('admin');
    professionalsRepository.findPaginated.mockResolvedValue({
      total: 1,
      rows: [
        {
          professional_id: professionalId,
          account_name: 'João Lima',
          account_email: 'joao.lima@exemplo.com',
          account_status: 'active',
          professional_specialism: 'speech_therapist',
          professional_council_number: '6789',
          professional_council_state: 'pr',
          professional_institution: 'CAPSi Boa Vista',
          professional_cnes: '1234567',
        },
      ],
    });

    const response = await request(app.getHttpServer()).get('/professionals');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      {
        id: professionalId,
        name: 'João Lima',
        email: 'joao.lima@exemplo.com',
        specialism: { id: 'speech_therapist', name: 'Fonoaudiólogo' },
        registration: { council: 'CRFa', number: '6789', state: 'pr' },
        institution: 'CAPSi Boa Vista',
        cnes: '1234567',
        status: 'active',
      },
    ]);
  });
});
