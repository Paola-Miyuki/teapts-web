// Este arquivo valida o contrato HTTP da listagem de contas, incluindo o
// ValidationPipe global e a restrição ao administrador.

import { jest } from '@jest/globals';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { AccountContext } from '../services/accounts.service';
import { AccountRole } from '../enums/account-role.enum';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import type { GetAccountsResponseDto } from '../dto/get-accounts-response.dto';
import { AccountsController } from './accounts.controller';
import { AccountsService } from '../services/accounts.service';

describe('GET /accounts', () => {
  let app: INestApplication;
  let accountContext: AccountContext;
  let accountsService: {
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
      findAll: jest.fn(async () => ({
        data: [{ id: 'account-1', name: 'Maria Silva' }],
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
      data: [{ id: 'account-1', name: 'Maria Silva' }],
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
});
