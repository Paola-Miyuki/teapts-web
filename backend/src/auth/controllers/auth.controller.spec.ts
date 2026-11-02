import { jest } from '@jest/globals';
import {
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccountRole } from '../../accounts/enums/account-role.enum';
import {
  AccountsService,
  type AccountContext,
} from '../../accounts/services/accounts.service';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import { AuthGuard } from '../guards/auth.guard';
import { AuthController } from './auth.controller';

const accountContext: AccountContext = {
  accountId: 'account-1',
  role: AccountRole.User,
  patientProfileId: null,
  professionalProfileIds: ['professional-1'],
};

const meResponse = {
  accountId: 'account-1',
  name: 'Maria Silva',
  email: 'maria@example.com',
  role: AccountRole.User,
  patientProfileId: null,
  professionalProfileIds: ['professional-1'],
};

describe('AuthController account routes', () => {
  let app: INestApplication;
  let guardCanActivate: jest.Mock;
  let accountsService: {
    updateMe: jest.Mock<
      (
        account: AccountContext,
        body: { role?: unknown; name?: string; email?: string },
      ) => Promise<unknown>
    >;
    changePassword: jest.Mock<
      (account: AccountContext, body: unknown) => Promise<unknown>
    >;
    findById: jest.Mock<(id: string) => Promise<unknown>>;
  };

  beforeEach(async () => {
    guardCanActivate = jest.fn((context: unknown) => {
      const req = (context as ExecutionContext).switchToHttp().getRequest<{
        accountContext?: AccountContext;
      }>();
      req.accountContext = accountContext;
      return true;
    });
    accountsService = {
      findById: jest.fn(async () => meResponse),
      updateMe: jest.fn(
        async (
          _account: AccountContext,
          body: { role?: unknown; name?: string; email?: string },
        ) => {
          if (body.role !== undefined) {
            throw new ForbiddenException({
              status: 'FORBIDDEN',
              message: 'Não é permitido alterar o papel da conta.',
            });
          }

          return {
            ...meResponse,
            name: body.name ?? meResponse.name,
            email: body.email ?? meResponse.email,
          };
        },
      ),
      changePassword: jest.fn(async () => ({ status: 'OK' })),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AccountsService, useValue: accountsService },
        AuthGuard,
      ],
    })
      .overrideProvider(AccountsService)
      .useValue(accountsService)
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

  it('returns 401 when the session is missing', async () => {
    guardCanActivate.mockImplementation(() => {
      throw new UnauthorizedException('Sessão não validada');
    });

    const response = await request(app.getHttpServer())
      .patch('/me')
      .send({ name: 'Ana' });

    expect(response.status).toBe(401);
    expect(accountsService.updateMe).not.toHaveBeenCalled();
  });

  it('returns the updated account from PATCH /me', async () => {
    const response = await request(app.getHttpServer())
      .patch('/me')
      .send({ name: 'Ana Silva' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ...meResponse, name: 'Ana Silva' });
    expect(accountsService.updateMe).toHaveBeenCalledWith(
      accountContext,
      expect.objectContaining({ name: 'Ana Silva' }),
    );
  });

  it('returns 400 for an invalid PATCH /me body', async () => {
    const response = await request(app.getHttpServer())
      .patch('/me')
      .send({ email: 'invalid' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 'VALIDATION_ERROR',
      message: 'Informe um e-mail válido.',
    });
    expect(accountsService.updateMe).not.toHaveBeenCalled();
  });

  it('returns 403 when role is present in PATCH /me', async () => {
    const response = await request(app.getHttpServer())
      .patch('/me')
      .send({ role: 'user' });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      status: 'FORBIDDEN',
      message: 'Não é permitido alterar o papel da conta.',
    });
  });

  it('returns 409 when PATCH /me finds a duplicate email', async () => {
    accountsService.updateMe.mockRejectedValue(
      new ConflictException({
        status: 'EMAIL_ALREADY_EXISTS',
        message: 'Este e-mail já está cadastrado.',
      }),
    );

    const response = await request(app.getHttpServer())
      .patch('/me')
      .send({ email: 'other@example.com' });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      status: 'EMAIL_ALREADY_EXISTS',
      message: 'Este e-mail já está cadastrado.',
    });
  });

  it('returns 200 for POST /me/password', async () => {
    const response = await request(app.getHttpServer())
      .post('/me/password')
      .send({
        currentPassword: 'Current123',
        newPassword: 'NewPassword123',
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'OK' });
    expect(accountsService.changePassword).toHaveBeenCalledWith(
      accountContext,
      expect.objectContaining({ currentPassword: 'Current123' }),
    );
  });

  it('returns 400 for an invalid password body', async () => {
    const response = await request(app.getHttpServer())
      .post('/me/password')
      .send({ currentPassword: 'Current123' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 'VALIDATION_ERROR',
      message: 'Informe a nova senha.',
    });
    expect(accountsService.changePassword).not.toHaveBeenCalled();
  });
});
