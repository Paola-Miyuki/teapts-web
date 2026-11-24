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
import type { GetAccountsResponseDto } from '../dto/get-accounts-response.dto';
import { AccountsController } from './accounts.controller';
import { AccountsService } from '../services/accounts.service';

describe('GET /accounts', () => {
  let app: INestApplication;
  let accountContext: AccountContext;
  let accountsService: {
    deactivate: jest.Mock<
      (id: string, executedBy: string) => Promise<DeactivateAccountResponseDto>
    >;
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
            name: 'Maria Silva',
            email: 'maria@exemplo.com',
            status: AccountStatus.Active,
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
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

  it('returns the paginated accounts to an admin', async () => {
    const response = await request(app.getHttpServer())
      .get('/accounts')
      .query({ isPatient: 'false', page: '1', limit: '20' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [
        {
          id: 'account-1',
          name: 'Maria Silva',
          email: 'maria@exemplo.com',
          status: AccountStatus.Active,
        },
      ],
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
