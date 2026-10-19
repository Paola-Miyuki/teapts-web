import { jest } from '@jest/globals';
import {
  BadRequestException,
  ExecutionContext,
  INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { AccountContext } from '../accounts/accounts.service';
import { AccountRole } from '../database/enums/account-role.enum';
import { AuthGuard } from '../auth/guards/auth.guard';
import type { GetAuthorizedPatientsResponseDto } from './dto/get-authorized-patients-response.dto';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';

const accountContext: AccountContext = {
  accountId: 'account-1',
  role: AccountRole.User,
  patientProfileId: null,
  professionalProfileIds: [],
};

function createController() {
  const response: GetAuthorizedPatientsResponseDto = {
    data: [],
    pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
  };
  const patientsService = { findAuthorized: jest.fn(async () => response) };
  const controller = new PatientsController(
    patientsService as unknown as PatientsService,
  );

  return { controller, patientsService, response };
}

describe('PatientsController.findAuthorized', () => {
  it('normalizes the query before calling the service', async () => {
    const { controller, patientsService, response } = createController();

    await expect(
      controller.findAuthorized(accountContext, { page: '2', limit: '20' }),
    ).resolves.toBe(response);
    expect(patientsService.findAuthorized).toHaveBeenCalledWith('account-1', {
      page: 2,
      limit: 20,
    });
  });

  it('rejects invalid query before calling the service', async () => {
    const { controller, patientsService } = createController();

    await expect(
      controller.findAuthorized(accountContext, { limit: 'invalid' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(patientsService.findAuthorized).not.toHaveBeenCalled();
  });
});

describe('GET /patients/authorized', () => {
  let app: INestApplication;
  let guardCanActivate: jest.Mock<(context: unknown) => boolean>;
  let patientsService: {
    findAuthorized: jest.Mock;
  };

  beforeEach(async () => {
    guardCanActivate = jest.fn((context: unknown) => {
      const req = (context as ExecutionContext).switchToHttp().getRequest<{
        accountContext?: AccountContext;
      }>();
      req.accountContext = accountContext;
      return true;
    });
    patientsService = {
      findAuthorized: jest.fn(async () => ({
        data: [{ id: 'patient-1', name: 'Maria Silva' }],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      })),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [PatientsController],
      providers: [
        { provide: PatientsService, useValue: patientsService },
        AuthGuard,
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: guardCanActivate })
      .compile();

    app = moduleRef.createNestApplication();
    app.useLogger(false);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns the paginated response through the HTTP route', async () => {
    const response = await request(app.getHttpServer())
      .get('/patients/authorized')
      .query({ page: 1, limit: 10 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [{ id: 'patient-1', name: 'Maria Silva' }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    expect(patientsService.findAuthorized).toHaveBeenCalledWith('account-1', {
      page: 1,
      limit: 10,
    });
  });

  it('returns validation error without calling the service', async () => {
    const response = await request(app.getHttpServer())
      .get('/patients/authorized')
      .query({ limit: 'invalid' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 'ERROR',
      message: 'Parâmetro inválido: limit',
    });
    expect(patientsService.findAuthorized).not.toHaveBeenCalled();
  });

  it('does not call the service when the guard blocks the request', async () => {
    guardCanActivate.mockReturnValue(false);

    const response = await request(app.getHttpServer()).get(
      '/patients/authorized',
    );

    expect(response.status).toBe(403);
    expect(patientsService.findAuthorized).not.toHaveBeenCalled();
  });
});
