// Este arquivo valida o contrato HTTP da rota de pacientes autorizados,
// incluindo o ValidationPipe global e o guard de autenticação.

import { jest } from '@jest/globals';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { AccountContext } from '../../accounts/services/accounts.service';
import { AccountRole } from '../../accounts/enums/account-role.enum';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import { PatientsController } from './patients.controller';
import { PatientsService } from '../services/patients.service';

const accountContext: AccountContext = {
  accountId: 'account-1',
  role: AccountRole.User,
  patientProfileId: null,
  professionalProfileIds: [],
};

describe('GET /patients/authorized', () => {
  let app: INestApplication;
  let guardCanActivate: jest.Mock;
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
    app.useGlobalPipes(createValidationPipe());
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
    expect(patientsService.findAuthorized).toHaveBeenCalledWith(
      'account-1',
      expect.objectContaining({ page: 1, limit: 10 }),
    );
  });

  it('passes the normalized query to the service', async () => {
    await request(app.getHttpServer())
      .get('/patients/authorized')
      .query({ page: '2', limit: '25' });

    expect(patientsService.findAuthorized).toHaveBeenCalledWith(
      'account-1',
      expect.objectContaining({ page: 2, limit: 25 }),
    );
  });

  it('returns a validation error without calling the service', async () => {
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

  it('does not call the service when authentication blocks the request', async () => {
    guardCanActivate.mockReturnValue(false);

    const response = await request(app.getHttpServer()).get(
      '/patients/authorized',
    );

    expect(response.status).toBe(403);
    expect(patientsService.findAuthorized).not.toHaveBeenCalled();
  });
});
