import { jest } from '@jest/globals';
import {
  ConflictException,
  ExecutionContext,
  INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { AccountContext } from '../../accounts/services/accounts.service';
import { AccountRole } from '../../accounts/enums/account-role.enum';
import { Specialism } from '../enums/specialism.enum';
import type { GetProfessionalsResponseDto } from '../dto/get-professionals-response.dto';
import type { ProfessionalProfileResponseDto } from '../dto/professional-profile-response.dto';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AccountStatus } from '../../accounts/enums/account-status.enum';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import { ProfessionalsController } from './professionals.controller';
import { ProfessionalsService } from '../services/professionals.service';

// O teste valida o contrato HTTP das rotas, com o ValidationPipe global, o
// guard de autenticação e a restrição ao admin no cadastro.
const listingAccount: AccountContext = {
  accountId: 'account-1',
  role: AccountRole.User,
  patientProfileId: null,
  professionalProfileIds: ['profile-1'],
};

describe('GET /professionals', () => {
  let app: INestApplication;
  let guardCanActivate: jest.Mock;
  let professionalsService: {
    findAll: jest.Mock<
      (
        account: Parameters<ProfessionalsService['findAll']>[0],
        input: Parameters<ProfessionalsService['findAll']>[1],
      ) => Promise<GetProfessionalsResponseDto>
    >;
  };

  beforeEach(async () => {
    guardCanActivate = jest.fn((context: unknown) => {
      (context as ExecutionContext)
        .switchToHttp()
        .getRequest<{ accountContext?: AccountContext }>().accountContext =
        listingAccount;
      return true;
    });
    professionalsService = {
      findAll: jest.fn(async () => ({
        data: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Maria Silva',
            email: 'maria@example.com',
            specialism: {
              id: Specialism.Psychologist,
              name: 'Psicólogo',
            },
            registration: null,
            institution: null,
            cnes: null,
            status: AccountStatus.Active,
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      })),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ProfessionalsController],
      providers: [
        {
          provide: ProfessionalsService,
          useValue: professionalsService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: guardCanActivate })
      .compile();

    app = moduleRef.createNestApplication();
    app.useLogger(false);
    app.useGlobalPipes(createValidationPipe());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns the paginated response through the HTTP route', async () => {
    const response = await request(app.getHttpServer())
      .get('/professionals')
      .query({
        page: 1,
        limit: 10,
        q: 'Maria',
        specialism: Specialism.Psychologist,
        ids: '550e8400-e29b-41d4-a716-446655440000',
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Maria Silva',
          email: 'maria@example.com',
          specialism: {
            id: Specialism.Psychologist,
            name: 'Psicólogo',
          },
          registration: null,
          institution: null,
          cnes: null,
          status: 'active',
        },
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    });
    expect(professionalsService.findAll).toHaveBeenCalledWith(listingAccount, {
      page: 1,
      limit: 10,
      q: 'Maria',
      specialism: ['psychologist'],
      ids: ['550e8400-e29b-41d4-a716-446655440000'],
    });
  });

  it('normalizes the query before calling the service', async () => {
    const response = await request(app.getHttpServer())
      .get('/professionals')
      .query({
        page: '2',
        limit: '20',
        q: '  Maria ',
        specialism: 'psychologist,doctor',
        council: 'CRP',
        councilState: 'pr',
        sort: 'specialism',
        order: 'desc',
        ids: '550e8400-e29b-41d4-a716-446655440000',
      });

    expect(response.status).toBe(200);
    expect(professionalsService.findAll).toHaveBeenCalledWith(listingAccount, {
      page: 2,
      limit: 20,
      q: 'Maria',
      specialism: ['psychologist', 'doctor'],
      council: ['CRP'],
      councilState: 'pr',
      sort: 'specialism',
      order: 'desc',
      ids: ['550e8400-e29b-41d4-a716-446655440000'],
    });
  });

  it('returns a validation error without calling the service', async () => {
    const response = await request(app.getHttpServer())
      .get('/professionals')
      .query({ limit: 'invalid' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 'ERROR',
      message: 'Parâmetro inválido: limit',
    });
    expect(professionalsService.findAll).not.toHaveBeenCalled();
  });

  it('does not call the service when authentication blocks the request', async () => {
    guardCanActivate.mockReturnValue(false);

    const response = await request(app.getHttpServer()).get('/professionals');

    expect(response.status).toBe(403);
    expect(professionalsService.findAll).not.toHaveBeenCalled();
  });
});

describe('POST /professionals', () => {
  const accountId = '0b6f5a4e-2c1d-4e8f-9a7b-3c2d1e0f9a8b';
  const body = {
    accountId,
    specialism: Specialism.Psychologist,
    councilNumber: '12345',
    councilState: 'pr',
    institution: 'CAPSi Boa Vista',
    cnes: '1234567',
  };
  const profile: ProfessionalProfileResponseDto = {
    id: '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f',
    accountId,
    name: 'Kaio Felipe',
    email: 'kaio@exemplo.com',
    specialism: { id: Specialism.Psychologist, name: 'Psicólogo' },
    registration: { council: 'CRP', number: '12345', state: 'pr' },
    institution: 'CAPSi Boa Vista',
    cnes: '1234567',
    deactivatedAt: null,
  };
  let app: INestApplication;
  let currentAccount: AccountContext;
  let professionalsService: {
    create: jest.Mock<
      (
        input: Parameters<ProfessionalsService['create']>[0],
        createdByAccountId: string,
      ) => Promise<ProfessionalProfileResponseDto>
    >;
  };

  beforeEach(async () => {
    currentAccount = {
      accountId: 'admin-1',
      role: AccountRole.Admin,
      patientProfileId: null,
      professionalProfileIds: [],
    };
    professionalsService = {
      create: jest.fn(async () => profile),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ProfessionalsController],
      providers: [
        { provide: ProfessionalsService, useValue: professionalsService },
        AdminGuard,
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context
            .switchToHttp()
            .getRequest<{ accountContext?: AccountContext }>().accountContext =
            currentAccount;
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useLogger(false);
    app.useGlobalPipes(createValidationPipe());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates the professional profile and answers 201', async () => {
    const response = await request(app.getHttpServer())
      .post('/professionals')
      .send(body);

    expect(response.status).toBe(201);
    expect(response.body).toEqual(profile);
    expect(professionalsService.create).toHaveBeenCalledWith(body, 'admin-1');
  });

  it('returns 400 VALIDATION_ERROR for an invalid specialism', async () => {
    const response = await request(app.getHttpServer())
      .post('/professionals')
      .send({ ...body, specialism: 'astronaut' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 'VALIDATION_ERROR',
      message: 'Informe uma especialidade válida.',
    });
    expect(professionalsService.create).not.toHaveBeenCalled();
  });

  it.each([
    ['councilNumber', { councilNumber: '' }, 'Informe o número do registro.'],
    ['councilState', { councilState: 'xx' }, 'Informe uma UF válida.'],
    ['cnes', { cnes: '123' }, 'O CNES deve ter 7 dígitos.'],
  ])(
    'returns 400 VALIDATION_ERROR for an invalid %s',
    async (_field, change, message) => {
      const response = await request(app.getHttpServer())
        .post('/professionals')
        .send({ ...body, ...change });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ status: 'VALIDATION_ERROR', message });
      expect(professionalsService.create).not.toHaveBeenCalled();
    },
  );

  it('returns 403 FORBIDDEN to a user who is not an admin', async () => {
    currentAccount.role = AccountRole.User;

    const response = await request(app.getHttpServer())
      .post('/professionals')
      .send(body);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      status: 'FORBIDDEN',
      message: 'Acesso restrito ao administrador.',
    });
    expect(professionalsService.create).not.toHaveBeenCalled();
  });

  it('relays the business errors of the service', async () => {
    professionalsService.create.mockRejectedValue(
      new ConflictException({
        status: 'PROFESSIONAL_PROFILE_ALREADY_EXISTS',
        message: 'A conta já possui um perfil profissional.',
      }),
    );

    const response = await request(app.getHttpServer())
      .post('/professionals')
      .send(body);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      status: 'PROFESSIONAL_PROFILE_ALREADY_EXISTS',
      message: 'A conta já possui um perfil profissional.',
    });
  });
});
