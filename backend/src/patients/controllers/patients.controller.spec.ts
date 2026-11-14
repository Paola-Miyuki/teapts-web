// Este arquivo valida o contrato HTTP das rotas de pacientes, incluindo o
// ValidationPipe global, o guard de autenticação e a restrição ao admin.

import { jest } from '@jest/globals';
import {
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  INestApplication,
  NotFoundException,
  UnauthorizedException,
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

  it('passes the normalized query to the service', async () => {
    await request(app.getHttpServer())
      .get('/patients/authorized')
      .query({ page: '2', limit: '25' });

    expect(patientsService.findAuthorized).toHaveBeenCalledWith(
      accountContext,
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

describe('/patients/:patientId/support-contacts', () => {
  const patientId = '0b6f5a4e-2c1d-4e8f-9a7b-3c2d1e0f9a8b';
  const route = `/patients/${patientId}/support-contacts`;
  const contact = {
    name: 'Joana Silva',
    description: 'Mãe',
    email: 'joana@example.com',
    phone: '(11) 98765-4321',
  };
  const profile = { accountId: patientId, supportContacts: [contact] };
  let app: INestApplication;
  let currentAccount: AccountContext;
  let authenticated: boolean;
  let patientsService: {
    findSupportContacts: jest.Mock<
      (account: unknown, patientId: unknown) => Promise<unknown>
    >;
    updateSupportContacts: jest.Mock<
      (account: unknown, patientId: unknown, body: unknown) => Promise<unknown>
    >;
  };

  beforeEach(async () => {
    currentAccount = { ...accountContext, patientProfileId: patientId };
    authenticated = true;
    patientsService = {
      findSupportContacts: jest.fn(async () => profile),
      updateSupportContacts: jest.fn(
        async (_account: unknown, id: unknown, body: unknown) => ({
          accountId: id,
          ...(body as object),
        }),
      ),
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
          if (!authenticated) {
            throw new UnauthorizedException();
          }

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

  describe('GET', () => {
    it('returns the profile with the current contacts', async () => {
      const response = await request(app.getHttpServer()).get(route);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(profile);
      expect(patientsService.findSupportContacts).toHaveBeenCalledWith(
        currentAccount,
        patientId,
      );
    });

    it('returns 400 VALIDATION_ERROR for a patientId that is not a UUID', async () => {
      const response = await request(app.getHttpServer()).get(
        '/patients/123/support-contacts',
      );

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        status: 'VALIDATION_ERROR',
        message: 'Parâmetro inválido: patientId',
      });
      expect(patientsService.findSupportContacts).not.toHaveBeenCalled();
    });

    it('returns 401 without a session', async () => {
      authenticated = false;

      const response = await request(app.getHttpServer()).get(route);

      expect(response.status).toBe(401);
      expect(patientsService.findSupportContacts).not.toHaveBeenCalled();
    });

    it('relays 404 PATIENT_NOT_FOUND from the service', async () => {
      patientsService.findSupportContacts.mockRejectedValue(
        new NotFoundException({
          status: 'PATIENT_NOT_FOUND',
          message: 'Paciente não encontrado.',
        }),
      );

      const response = await request(app.getHttpServer()).get(route);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        status: 'PATIENT_NOT_FOUND',
        message: 'Paciente não encontrado.',
      });
    });
  });

  describe('PUT', () => {
    it('replaces the list and returns the profile with the new contacts', async () => {
      const response = await request(app.getHttpServer())
        .put(route)
        .send({ supportContacts: [contact] });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(profile);
      expect(patientsService.updateSupportContacts).toHaveBeenCalledWith(
        currentAccount,
        patientId,
        { supportContacts: [contact] },
      );
    });

    it('accepts an empty list', async () => {
      const response = await request(app.getHttpServer())
        .put(route)
        .send({ supportContacts: [] });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        accountId: patientId,
        supportContacts: [],
      });
    });

    it('lets the admin reach the service, which checks the access', async () => {
      currentAccount = { ...accountContext, role: AccountRole.Admin };

      const response = await request(app.getHttpServer())
        .put(route)
        .send({ supportContacts: [contact] });

      expect(response.status).toBe(200);
      expect(patientsService.updateSupportContacts).toHaveBeenCalledWith(
        currentAccount,
        patientId,
        { supportContacts: [contact] },
      );
    });

    it.each([
      [
        'a contact without name',
        { supportContacts: [{ email: 'joana@example.com' }] },
        'Informe o nome do contato.',
      ],
      [
        'an invalid contact email',
        { supportContacts: [{ name: 'Joana', email: 'joana' }] },
        'Informe um e-mail válido para o contato.',
      ],
      [
        'an invalid contact phone',
        { supportContacts: [contact, { name: 'Pedro', phone: 1234 }] },
        'Informe um telefone válido para o contato.',
      ],
    ])(
      'returns 400 VALIDATION_ERROR for %s and saves nothing',
      async (_case, body, message) => {
        const response = await request(app.getHttpServer())
          .put(route)
          .send(body);

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ status: 'VALIDATION_ERROR', message });
        expect(patientsService.updateSupportContacts).not.toHaveBeenCalled();
      },
    );

    it('returns 400 VALIDATION_ERROR for a patientId that is not a UUID', async () => {
      const response = await request(app.getHttpServer())
        .put('/patients/123/support-contacts')
        .send({ supportContacts: [contact] });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        status: 'VALIDATION_ERROR',
        message: 'Parâmetro inválido: patientId',
      });
      expect(patientsService.updateSupportContacts).not.toHaveBeenCalled();
    });

    it('returns 401 without a session', async () => {
      authenticated = false;

      const response = await request(app.getHttpServer())
        .put(route)
        .send({ supportContacts: [contact] });

      expect(response.status).toBe(401);
      expect(patientsService.updateSupportContacts).not.toHaveBeenCalled();
    });

    it('relays 403 FORBIDDEN from the service', async () => {
      patientsService.updateSupportContacts.mockRejectedValue(
        new ForbiddenException({
          status: 'FORBIDDEN',
          message: 'Acesso restrito ao administrador ou ao próprio paciente.',
        }),
      );

      const response = await request(app.getHttpServer())
        .put(route)
        .send({ supportContacts: [contact] });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        status: 'FORBIDDEN',
        message: 'Acesso restrito ao administrador ou ao próprio paciente.',
      });
    });

    it('relays 404 PATIENT_NOT_FOUND from the service', async () => {
      patientsService.updateSupportContacts.mockRejectedValue(
        new NotFoundException({
          status: 'PATIENT_NOT_FOUND',
          message: 'Paciente não encontrado.',
        }),
      );

      const response = await request(app.getHttpServer())
        .put(route)
        .send({ supportContacts: [contact] });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        status: 'PATIENT_NOT_FOUND',
        message: 'Paciente não encontrado.',
      });
    });
  });
});
