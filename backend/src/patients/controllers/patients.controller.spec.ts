// Este arquivo valida o contrato HTTP das rotas de pacientes, incluindo o
// ValidationPipe global, o guard de autenticação e a restrição ao admin.

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
import { AdminGuard } from '../../auth/guards/admin.guard';
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
    findOne: jest.Mock;
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
      findOne: jest.fn(async () => ({ id: 'patient-1', name: 'Maria Silva' })),
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
        AdminGuard,
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
      accountContext,
      expect.objectContaining({ page: 1, limit: 10 }),
    );
  });

  it('passes the trimmed search and the filters to the service', async () => {
    await request(app.getHttpServer()).get('/patients/authorized').query({
      q: '  mari  ',
      status: 'running,concluded',
      sort: 'registeredAt',
    });

    expect(patientsService.findAuthorized).toHaveBeenCalledWith(
      accountContext,
      expect.objectContaining({
        q: 'mari',
        status: ['running', 'concluded'],
        sort: 'registeredAt',
      }),
    );
  });

  it('passes the normalized query to the service', async () => {
    await request(app.getHttpServer())
      .get('/patients/authorized')
      .query({ page: '2', limit: '25' });

    expect(patientsService.findAuthorized).toHaveBeenCalledWith(
      accountContext,
      expect.objectContaining({ page: 2, limit: 25 }),
    );
  });

  it('routes GET /patients/:id to the detail with the account', async () => {
    const id = '0b6f5a4e-2c1d-4e8f-9a7b-3c2d1e0f9a8b';
    const response = await request(app.getHttpServer()).get(`/patients/${id}`);

    expect(response.status).toBe(200);
    expect(patientsService.findOne).toHaveBeenCalledWith(accountContext, id);
  });

  it('answers 400 for a patient id that is not a UUID', async () => {
    const response = await request(app.getHttpServer()).get('/patients/abc');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 'ERROR',
      message: 'Parâmetro inválido: id',
    });
    expect(patientsService.findOne).not.toHaveBeenCalled();
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

describe('GET /patients/available-for-pts', () => {
  let app: INestApplication;
  let currentAccount: AccountContext;
  let guardCanActivate: jest.Mock;
  let patientsService: {
    findAvailableForPts: jest.Mock;
  };

  beforeEach(async () => {
    currentAccount = {
      ...accountContext,
      professionalProfileIds: ['professional-1'],
    };
    guardCanActivate = jest.fn((context: unknown) => {
      const req = (context as ExecutionContext).switchToHttp().getRequest<{
        accountContext?: AccountContext;
      }>();
      req.accountContext = currentAccount;
      return true;
    });
    patientsService = {
      findAvailableForPts: jest.fn(async () => ({
        data: [{ id: 'patient-1', name: 'Maria Silva' }],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      })),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [PatientsController],
      providers: [
        { provide: PatientsService, useValue: patientsService },
        AuthGuard,
        AdminGuard,
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

  it('returns patients without an active PTS for professionals', async () => {
    const response = await request(app.getHttpServer())
      .get('/patients/available-for-pts')
      .query({ page: 1, limit: 10 });

    expect(response.status).toBe(200);
    expect(patientsService.findAvailableForPts).toHaveBeenCalledWith(
      currentAccount,
      expect.objectContaining({ page: 1, limit: 10 }),
    );
  });
});

describe('POST /patients', () => {
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
  let currentAccount: AccountContext;
  let patientsService: {
    create: jest.Mock<(request: unknown) => Promise<unknown>>;
  };

  beforeEach(async () => {
    currentAccount = { ...accountContext, role: AccountRole.Admin };
    patientsService = {
      create: jest.fn(async (request: unknown) => request),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [PatientsController],
      providers: [
        { provide: PatientsService, useValue: patientsService },
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

  it('creates the patient profile and answers 201', async () => {
    const response = await request(app.getHttpServer())
      .post('/patients')
      .send(body);

    expect(response.status).toBe(201);
    expect(response.body).toEqual(body);
    expect(patientsService.create).toHaveBeenCalledWith(body);
  });

  it('returns 400 VALIDATION_ERROR for an invalid body', async () => {
    const response = await request(app.getHttpServer())
      .post('/patients')
      .send({ accountId, supportContacts: [{ email: 'maria' }] });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 'VALIDATION_ERROR',
      message: 'Informe o nome do contato.',
    });
    expect(patientsService.create).not.toHaveBeenCalled();
  });

  it('returns 403 FORBIDDEN to a user who is not an admin', async () => {
    currentAccount.role = AccountRole.User;

    const response = await request(app.getHttpServer())
      .post('/patients')
      .send(body);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      status: 'FORBIDDEN',
      message: 'Acesso restrito ao administrador.',
    });
    expect(patientsService.create).not.toHaveBeenCalled();
  });

  it('relays the business errors of the service', async () => {
    patientsService.create.mockRejectedValue(
      new ConflictException({
        status: 'PATIENT_PROFILE_ALREADY_EXISTS',
        message: 'A conta já possui perfil de paciente.',
      }),
    );

    const response = await request(app.getHttpServer())
      .post('/patients')
      .send(body);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      status: 'PATIENT_PROFILE_ALREADY_EXISTS',
      message: 'A conta já possui perfil de paciente.',
    });
  });
});

describe('support contacts routes', () => {
  const patientId = '5f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b';
  const contactId = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
  let app: INestApplication;
  let patientsService: {
    findSupportContacts: jest.Mock;
    createSupportContact: jest.Mock;
    updateSupportContact: jest.Mock;
    deleteSupportContact: jest.Mock;
  };

  beforeEach(async () => {
    patientsService = {
      findSupportContacts: jest.fn(async () => ({ data: [] })),
      createSupportContact: jest.fn(async () => ({ id: contactId })),
      updateSupportContact: jest.fn(async () => ({ id: contactId })),
      deleteSupportContact: jest.fn(async () => undefined),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [PatientsController],
      providers: [
        { provide: PatientsService, useValue: patientsService },
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

  it('routes GET to the list with the account and the patient', async () => {
    const response = await request(app.getHttpServer()).get(
      `/patients/${patientId}/support-contacts`,
    );

    expect(response.status).toBe(200);
    expect(patientsService.findSupportContacts).toHaveBeenCalledWith(
      accountContext,
      patientId,
    );
  });

  it('routes POST with the validated body and answers 201', async () => {
    const response = await request(app.getHttpServer())
      .post(`/patients/${patientId}/support-contacts`)
      .send({ name: ' Joana ', phone: '(11) 98765-4321' });

    expect(response.status).toBe(201);
    expect(patientsService.createSupportContact).toHaveBeenCalledWith(
      accountContext,
      patientId,
      expect.objectContaining({ name: 'Joana', phone: '(11) 98765-4321' }),
    );
  });

  it('answers 400 for a POST without e-mail and phone, without calling the service', async () => {
    const response = await request(app.getHttpServer())
      .post(`/patients/${patientId}/support-contacts`)
      .send({ name: 'Joana' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 'VALIDATION_ERROR',
      message: 'Informe o e-mail ou o telefone do contato.',
    });
    expect(patientsService.createSupportContact).not.toHaveBeenCalled();
  });

  it('routes PATCH with the contact id and a partial body', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/patients/${patientId}/support-contacts/${contactId}`)
      .send({ email: null });

    expect(response.status).toBe(200);
    expect(patientsService.updateSupportContact).toHaveBeenCalledWith(
      accountContext,
      patientId,
      contactId,
      { email: null },
    );
  });

  it('routes DELETE and answers 204', async () => {
    const response = await request(app.getHttpServer()).delete(
      `/patients/${patientId}/support-contacts/${contactId}`,
    );

    expect(response.status).toBe(204);
    expect(patientsService.deleteSupportContact).toHaveBeenCalledWith(
      accountContext,
      patientId,
      contactId,
    );
  });

  it.each([
    ['get', `/patients/abc/support-contacts`, 'patientId'],
    ['delete', `/patients/${patientId}/support-contacts/abc`, 'contactId'],
  ] as const)(
    'answers 400 for a %s with an id that is not a UUID',
    async (method, url, name) => {
      const response = await request(app.getHttpServer())[method](url);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        status: 'VALIDATION_ERROR',
        message: `Parâmetro inválido: ${name}`,
      });
    },
  );
});
