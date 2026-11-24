// Este arquivo valida o contrato HTTP da listagem de contas, incluindo o
// ValidationPipe global, a busca `q` e a restrição ao administrador.

import { jest } from '@jest/globals';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { AccountContext } from '../services/accounts.service';
import { AccountRole } from '../enums/account-role.enum';
import { AccountStatus } from '../enums/account-status.enum';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import type { DeactivateAccountResponseDto } from '../dto/deactivate-account-response.dto';
import type { GetAccountResponseDto } from '../dto/get-account-response.dto';
import { Sex } from '../enums/sex.enum';
import type { GetAccountsResponseDto } from '../dto/get-accounts-response.dto';
import { AccountsController } from './accounts.controller';
import { AccountsService } from '../services/accounts.service';

const listedAccount = {
  name: 'Maria Silva',
  socialName: null,
  email: 'maria@exemplo.com',
  cpf: '52998224725',
  role: AccountRole.User,
  profile: 'professional' as const,
  specialisms: ['psychologist'],
  status: AccountStatus.Active,
  createdAt: '2026-11-10T15:00:00.000Z',
};

const accountDetail: GetAccountResponseDto = {
  id: 'account-1',
  fullName: 'Maria Silva',
  socialName: null,
  birthDate: '1990-05-20',
  sex: Sex.Female,
  gender: null,
  cpf: '52998224725',
  email: 'maria@exemplo.com',
  phone: null,
  role: AccountRole.User,
  status: AccountStatus.Active,
  createdAt: '2026-11-10T15:00:00.000Z',
  updatedAt: null,
  profile: { type: 'professional', specialisms: ['psychologist'] },
};

describe('GET /accounts', () => {
  let app: INestApplication;
  let accountContext: AccountContext;
  let accountsService: {
    deactivate: jest.Mock<
      (id: string, executedBy: string) => Promise<DeactivateAccountResponseDto>
    >;
    findDetail: jest.Mock<(id: string) => Promise<GetAccountResponseDto>>;
    findAll: jest.Mock<
      (
        input: Parameters<AccountsService['findAll']>[0],
      ) => Promise<GetAccountsResponseDto>
    >;
  };

  beforeEach(async () => {
    accountContext = {
      accountId: 'admin-1',
      role: AccountRole.Admin,
      patientProfileId: null,
      professionalProfileIds: [],
    };
    accountsService = {
      deactivate: jest.fn(async (id: string) => ({
        id,
        status: AccountStatus.Inactive as const,
        deactivatedAt: '2026-11-10T15:00:00.000Z',
      })),
      findAll: jest.fn(async () => ({
        data: [
          {
            id: 'account-1',
            ...listedAccount,
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      })),
      findDetail: jest.fn(async (id: string) => ({ ...accountDetail, id })),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AccountsController],
      providers: [
        { provide: AccountsService, useValue: accountsService },
        AuthGuard,
        AdminGuard,
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context
            .switchToHttp()
            .getRequest<{ accountContext?: AccountContext }>().accountContext =
            accountContext;
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

  it('returns the paginated accounts to an admin', async () => {
    const response = await request(app.getHttpServer())
      .get('/accounts')
      .query({ isPatient: 'false', page: '1', limit: '20' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [{ id: 'account-1', ...listedAccount }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect(accountsService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ isPatient: false, page: 1, limit: 20 }),
    );
  });

  it('lists every account without filters', async () => {
    await request(app.getHttpServer()).get('/accounts').expect(200);

    expect(accountsService.findAll).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
    });
  });

  it('passes the trimmed search with the filters to the service', async () => {
    await request(app.getHttpServer())
      .get('/accounts')
      .query({ q: '  mari  ', isPatient: 'true', page: '2' })
      .expect(200);

    expect(accountsService.findAll).toHaveBeenCalledWith({
      q: 'mari',
      isPatient: true,
      page: 2,
      limit: 20,
    });
  });

  it('normalizes the new filters, sort and order before the service', async () => {
    await request(app.getHttpServer())
      .get('/accounts?profile=none,patient&profile=admin&status=inactive')
      .query({
        createdFrom: '2026-10-01',
        createdTo: '2026-11-24',
        sort: 'createdAt',
        order: 'desc',
      })
      .expect(200);

    expect(accountsService.findAll).toHaveBeenCalledWith({
      profile: ['none', 'patient', 'admin'],
      status: 'inactive',
      createdFrom: '2026-10-01',
      createdTo: '2026-11-24',
      sort: 'createdAt',
      order: 'desc',
      page: 1,
      limit: 20,
    });
  });

  it.each([
    ['profile', { profile: 'guest' }],
    ['status', { status: 'blocked' }],
    ['createdFrom', { createdFrom: '2026-13-40' }],
    ['createdTo', { createdTo: '24/11/2026' }],
    ['sort', { sort: 'email' }],
    ['order', { order: 'up' }],
  ])('returns 400 ERROR for an invalid %s', async (parameter, query) => {
    const response = await request(app.getHttpServer())
      .get('/accounts')
      .query(query);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 'ERROR',
      message: `Parâmetro inválido: ${parameter}`,
    });
    expect(accountsService.findAll).not.toHaveBeenCalled();
  });

  it('lists without search when q has only spaces', async () => {
    await request(app.getHttpServer())
      .get('/accounts')
      .query({ q: '   ' })
      .expect(200);

    expect(accountsService.findAll).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
    });
  });

  it('returns 400 ERROR for an invalid search without calling the service', async () => {
    const response = await request(app.getHttpServer()).get(
      '/accounts?q=mari&q=ana',
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 'ERROR',
      message: 'Parâmetro inválido: q',
    });
    expect(accountsService.findAll).not.toHaveBeenCalled();
  });

  it('returns 400 ERROR for an invalid filter without calling the service', async () => {
    const response = await request(app.getHttpServer())
      .get('/accounts')
      .query({ isProfessional: 'yes' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 'ERROR',
      message: 'Parâmetro inválido: isProfessional',
    });
    expect(accountsService.findAll).not.toHaveBeenCalled();
  });

  it('returns 403 FORBIDDEN to a user who is not an admin', async () => {
    accountContext.role = AccountRole.User;

    const response = await request(app.getHttpServer()).get('/accounts');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      status: 'FORBIDDEN',
      message: 'Acesso restrito ao administrador.',
    });
    expect(accountsService.findAll).not.toHaveBeenCalled();
  });

  // Só o admin lista e consulta as contas (RN032).
  it.each([
    [
      'professional',
      { patientProfileId: null, professionalProfileIds: ['p-1'] },
    ],
    ['patient', { patientProfileId: 'user-1', professionalProfileIds: [] }],
  ])('returns 403 FORBIDDEN to a %s', async (_, profiles) => {
    accountContext = {
      accountId: 'user-1',
      role: AccountRole.User,
      ...profiles,
    };

    const response = await request(app.getHttpServer()).get('/accounts');

    expect(response.status).toBe(403);
    expect(accountsService.findAll).not.toHaveBeenCalled();
  });
});

describe('GET /accounts/:id', () => {
  const id = '0b6f5a4e-2c1d-4e8f-9a7b-3c2d1e0f9a8b';
  let app: INestApplication;
  let accountContext: AccountContext;
  const accountsService = {
    findDetail: jest.fn<(id: string) => Promise<GetAccountResponseDto>>(),
  };

  beforeEach(async () => {
    accountContext = {
      accountId: 'admin-1',
      role: AccountRole.Admin,
      patientProfileId: null,
      professionalProfileIds: [],
    };
    accountsService.findDetail.mockReset();
    accountsService.findDetail.mockResolvedValue({ ...accountDetail, id });

    const moduleRef = await Test.createTestingModule({
      controllers: [AccountsController],
      providers: [
        { provide: AccountsService, useValue: accountsService },
        AuthGuard,
        AdminGuard,
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context
            .switchToHttp()
            .getRequest<{ accountContext?: AccountContext }>().accountContext =
            accountContext;
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

  it('returns the account data to an admin', async () => {
    const response = await request(app.getHttpServer()).get(`/accounts/${id}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ...accountDetail, id });
    expect(accountsService.findDetail).toHaveBeenCalledWith(id);
  });

  it('returns 403 FORBIDDEN to a user who is not an admin', async () => {
    accountContext.role = AccountRole.User;

    const response = await request(app.getHttpServer()).get(`/accounts/${id}`);

    expect(response.status).toBe(403);
    expect(accountsService.findDetail).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_ERROR for an id that is not a UUID', async () => {
    const response = await request(app.getHttpServer()).get('/accounts/abc');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 'VALIDATION_ERROR',
      message: 'Parâmetro inválido: id',
    });
    expect(accountsService.findDetail).not.toHaveBeenCalled();
  });
});

describe('DELETE /accounts/:id', () => {
  const targetId = '0b6f5a4e-2c1d-4e8f-9a7b-3c2d1e0f9a8b';
  let app: INestApplication;
  let accountContext: AccountContext;
  let accountsService: {
    deactivate: jest.Mock<
      (id: string, executedBy: string) => Promise<DeactivateAccountResponseDto>
    >;
  };

  beforeEach(async () => {
    accountContext = {
      accountId: 'admin-1',
      role: AccountRole.Admin,
      patientProfileId: null,
      professionalProfileIds: [],
    };
    accountsService = {
      deactivate: jest.fn(async (id: string) => ({
        id,
        status: AccountStatus.Inactive as const,
        deactivatedAt: '2026-11-10T15:00:00.000Z',
      })),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AccountsController],
      providers: [
        { provide: AccountsService, useValue: accountsService },
        AuthGuard,
        AdminGuard,
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context
            .switchToHttp()
            .getRequest<{ accountContext?: AccountContext }>().accountContext =
            accountContext;
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

  it('lets an admin deactivate any account', async () => {
    const response = await request(app.getHttpServer()).delete(
      `/accounts/${targetId}`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: targetId,
      status: 'inactive',
      deactivatedAt: '2026-11-10T15:00:00.000Z',
    });
    expect(accountsService.deactivate).toHaveBeenCalledWith(
      targetId,
      'admin-1',
    );
  });

  it('returns 403 FORBIDDEN to a user who is not an admin', async () => {
    accountContext.role = AccountRole.User;

    const response = await request(app.getHttpServer()).delete(
      `/accounts/${targetId}`,
    );

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      status: 'FORBIDDEN',
      message: 'Acesso restrito ao administrador.',
    });
    expect(accountsService.deactivate).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_ERROR for an id that is not a UUID', async () => {
    const response = await request(app.getHttpServer()).delete(
      '/accounts/not-a-uuid',
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 'VALIDATION_ERROR',
      message: 'Parâmetro inválido: id',
    });
    expect(accountsService.deactivate).not.toHaveBeenCalled();
  });
});
