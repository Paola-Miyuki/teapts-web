import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConflictException, Logger, NotFoundException } from '@nestjs/common';
import Session from 'supertokens-node/recipe/session';
import { RecipeUserId } from 'supertokens-node';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import { AccountRole } from '../enums/account-role.enum';
import { AccountStatus } from '../enums/account-status.enum';
import { Gender } from '../enums/gender.enum';
import { Sex } from '../enums/sex.enum';
import type {
  AccountsPage,
  AccountsQuery,
  AccountsRepository,
  DeactivationResult,
} from '../repositories/accounts.repository';
import { AccountsService } from './accounts.service';

describe('AccountsService', () => {
  const accountRepository = {
    create: jest.fn<(value?: unknown) => unknown>(),
    save: jest.fn<(value?: unknown) => Promise<unknown>>(),
    findOne: jest.fn<(value?: unknown) => unknown>(),
    exists: jest.fn<(value?: unknown) => Promise<boolean>>(),
  };
  const accountsRepository = {
    findPaginated: jest.fn<(filters: AccountsQuery) => Promise<AccountsPage>>(),
    deactivate:
      jest.fn<
        (accountId: string, executedBy: string) => Promise<DeactivationResult>
      >(),
  };
  let service: AccountsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AccountsService(
      accountRepository as never,
      accountsRepository as unknown as AccountsRepository,
    );
  });

  it('creates an account linked to the SuperTokens user', async () => {
    const account = {
      id: 'account-1',
      supertokensUserId: 'user-1',
      name: 'Pessoa Teste',
      email: 'pessoa@example.com',
      role: AccountRole.User,
      lastUpdatedAt: null,
    };
    accountRepository.create.mockReturnValue(account as never);
    accountRepository.save.mockResolvedValue(account as never);

    await expect(
      service.createAccount({
        supertokensUserId: 'user-1',
        name: ' Pessoa Teste ',
        email: ' PESSOA@EXAMPLE.COM ',
        socialName: ' ',
        birthDate: '1990-05-20',
        sex: Sex.Female,
        gender: null,
        cpf: '52998224725',
        phone: '11987654321',
      }),
    ).resolves.toBe(account);

    expect(accountRepository.create).toHaveBeenCalledWith({
      supertokensUserId: 'user-1',
      name: 'Pessoa Teste',
      email: 'pessoa@example.com',
      socialName: null,
      birthDate: '1990-05-20',
      sex: Sex.Female,
      gender: null,
      cpf: '52998224725',
      phone: '11987654321',
      role: AccountRole.User,
      lastUpdatedAt: null,
    });
  });

  it('tells whether another account already uses the CPF', async () => {
    accountRepository.exists.mockResolvedValue(true);

    await expect(service.isCpfTaken('52998224725')).resolves.toBe(true);
    expect(accountRepository.exists).toHaveBeenCalledWith({
      where: { cpf: '52998224725' },
    });
  });

  it('finds an account by id', async () => {
    const account = { id: 'account-1' };
    accountRepository.findOne.mockResolvedValue(account as never);

    await expect(service.findById('account-1')).resolves.toBe(account);
    expect(accountRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'account-1' },
    });
  });

  it('throws when an account does not exist', async () => {
    accountRepository.findOne.mockResolvedValue(null as never);

    await expect(service.findById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  describe('updateMe', () => {
    const accountContext = {
      accountId: 'account-1',
      role: AccountRole.User,
      patientProfileId: null,
      professionalProfileIds: ['professional-1'],
    };
    const account = {
      id: 'account-1',
      supertokensUserId: 'user-1',
      name: 'Maria Silva',
      email: 'maria@example.com',
      role: AccountRole.User,
      socialName: null,
      birthDate: '1990-05-20',
      sex: Sex.Female,
      gender: null,
      cpf: '52998224725',
      phone: null,
      createdAt: new Date('2026-01-10T12:00:00.000Z'),
      lastUpdatedAt: null,
    };

    beforeEach(() => {
      accountRepository.findOne.mockResolvedValue(account as never);
      accountRepository.save.mockImplementation(
        async (value) => value as never,
      );
    });

    it('updates only the name without calling SuperTokens', async () => {
      const updateEmailOrPassword = jest
        .spyOn(EmailPassword, 'updateEmailOrPassword')
        .mockResolvedValue({ status: 'OK' });

      await expect(
        service.updateMe(accountContext, { name: 'Ana Silva' }),
      ).resolves.toMatchObject({ name: 'Ana Silva' });

      expect(updateEmailOrPassword).not.toHaveBeenCalled();
      expect(accountRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Ana Silva' }),
      );
    });

    it('updates the personal data and returns it, keeping the CPF', async () => {
      await expect(
        service.updateMe(accountContext, {
          socialName: 'Mari',
          birthDate: '1991-02-03',
          sex: Sex.Male,
          gender: Gender.NonBinary,
          phone: '11987654321',
        }),
      ).resolves.toMatchObject({
        socialName: 'Mari',
        birthDate: '1991-02-03',
        sex: Sex.Male,
        gender: Gender.NonBinary,
        cpf: '52998224725',
        phone: '11987654321',
        createdAt: '2026-01-10T12:00:00.000Z',
        updatedAt: expect.any(String),
      });
    });

    it('clears the optional personal data sent as null', async () => {
      accountRepository.findOne.mockResolvedValueOnce({
        ...account,
        socialName: 'Mari',
        gender: Gender.Other,
        phone: '11987654321',
      } as never);

      await expect(
        service.updateMe(accountContext, {
          socialName: null,
          gender: null,
          phone: null,
        }),
      ).resolves.toMatchObject({ socialName: null, gender: null, phone: null });
    });

    it('updates and normalizes a changed email', async () => {
      const updateEmailOrPassword = jest
        .spyOn(EmailPassword, 'updateEmailOrPassword')
        .mockResolvedValue({ status: 'OK' });
      accountRepository.findOne
        .mockResolvedValueOnce(account as never)
        .mockResolvedValueOnce(null as never);

      await expect(
        service.updateMe(accountContext, {
          email: ' ANA@EXAMPLE.COM ',
        }),
      ).resolves.toMatchObject({ email: 'ana@example.com' });

      expect(updateEmailOrPassword).toHaveBeenCalledTimes(1);
      expect(updateEmailOrPassword).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'ana@example.com' }),
      );
      const [{ recipeUserId }] = updateEmailOrPassword.mock.calls[0];
      expect(recipeUserId).toBeInstanceOf(RecipeUserId);
      expect(recipeUserId.getAsString()).toBe('user-1');
      expect(accountRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'ana@example.com',
          lastUpdatedAt: expect.any(Date),
        }),
      );
    });

    it('rejects an email owned by another account without changing either system', async () => {
      const updateEmailOrPassword = jest
        .spyOn(EmailPassword, 'updateEmailOrPassword')
        .mockResolvedValue({ status: 'OK' });
      accountRepository.findOne
        .mockResolvedValueOnce(account as never)
        .mockResolvedValueOnce({ id: 'account-2' } as never);

      await expect(
        service.updateMe(accountContext, { email: 'other@example.com' }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(updateEmailOrPassword).not.toHaveBeenCalled();
      expect(accountRepository.save).not.toHaveBeenCalled();
    });

    it('returns 409 when only SuperTokens already has the email', async () => {
      const updateEmailOrPassword = jest
        .spyOn(EmailPassword, 'updateEmailOrPassword')
        .mockResolvedValue({ status: 'EMAIL_ALREADY_EXISTS_ERROR' });
      accountRepository.findOne
        .mockResolvedValueOnce(account as never)
        .mockResolvedValueOnce(null as never);

      await expect(
        service.updateMe(accountContext, { email: 'other@example.com' }),
      ).rejects.toMatchObject({
        status: 409,
        response: { status: 'EMAIL_ALREADY_EXISTS' },
      });

      expect(updateEmailOrPassword).toHaveBeenCalledTimes(1);
      expect(accountRepository.save).not.toHaveBeenCalled();
    });

    it('allows the account to submit its own email', async () => {
      const updateEmailOrPassword = jest
        .spyOn(EmailPassword, 'updateEmailOrPassword')
        .mockResolvedValue({ status: 'OK' });
      accountRepository.findOne.mockResolvedValueOnce(account as never);

      await expect(
        service.updateMe(accountContext, { email: 'MARIA@EXAMPLE.COM' }),
      ).resolves.toMatchObject({ email: 'maria@example.com' });

      expect(updateEmailOrPassword).not.toHaveBeenCalled();
    });

    it('rolls back SuperTokens when saving the account fails', async () => {
      const updateEmailOrPassword = jest
        .spyOn(EmailPassword, 'updateEmailOrPassword')
        .mockResolvedValue({ status: 'OK' });
      accountRepository.findOne
        .mockResolvedValueOnce(account as never)
        .mockResolvedValueOnce(null as never);
      accountRepository.save.mockRejectedValue(new Error('database failed'));

      await expect(
        service.updateMe(accountContext, { email: 'ana@example.com' }),
      ).rejects.toThrow('database failed');

      expect(updateEmailOrPassword).toHaveBeenCalledTimes(2);
      expect(updateEmailOrPassword).toHaveBeenLastCalledWith(
        expect.objectContaining({ email: 'maria@example.com' }),
      );
    });
  });

  describe('changePassword', () => {
    const accountContext = {
      accountId: 'account-1',
      role: AccountRole.User,
      patientProfileId: null,
      professionalProfileIds: [],
    };

    beforeEach(() => {
      accountRepository.findOne.mockResolvedValue({
        id: 'account-1',
        supertokensUserId: 'user-1',
        email: 'maria@example.com',
      } as never);
    });

    it('rejects an incorrect current password', async () => {
      jest
        .spyOn(EmailPassword, 'verifyCredentials')
        .mockResolvedValue({ status: 'WRONG_CREDENTIALS_ERROR' });

      await expect(
        service.changePassword(accountContext, {
          currentPassword: 'wrong',
          newPassword: 'NewPassword123',
        }),
      ).rejects.toMatchObject({
        response: {
          status: 'INVALID_CURRENT_PASSWORD',
        },
      });
    });

    it('returns the policy error from SuperTokens', async () => {
      jest
        .spyOn(EmailPassword, 'verifyCredentials')
        .mockResolvedValue({ status: 'OK' });
      jest.spyOn(EmailPassword, 'updateEmailOrPassword').mockResolvedValue({
        status: 'PASSWORD_POLICY_VIOLATED_ERROR',
        failureReason: 'A senha deve conter pelo menos 8 caracteres.',
      });

      await expect(
        service.changePassword(accountContext, {
          currentPassword: 'Current123',
          newPassword: 'short',
        }),
      ).rejects.toMatchObject({
        response: {
          status: 'VALIDATION_ERROR',
          message: 'A senha deve conter pelo menos 8 caracteres.',
        },
      });
    });

    it('changes the password successfully', async () => {
      const verifyCredentials = jest
        .spyOn(EmailPassword, 'verifyCredentials')
        .mockResolvedValue({ status: 'OK' });
      const updateEmailOrPassword = jest
        .spyOn(EmailPassword, 'updateEmailOrPassword')
        .mockResolvedValue({ status: 'OK' });

      await expect(
        service.changePassword(accountContext, {
          currentPassword: 'Current123',
          newPassword: 'NewPassword123',
        }),
      ).resolves.toEqual({ status: 'OK' });

      expect(verifyCredentials).toHaveBeenCalledWith(
        'public',
        'maria@example.com',
        'Current123',
      );
      expect(updateEmailOrPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          password: 'NewPassword123',
          applyPasswordPolicy: true,
          tenantIdForPasswordPolicy: 'public',
        }),
      );
    });
  });

  describe('findAll', () => {
    it('passes the filters and returns only the public summary', async () => {
      const request = { page: 2, limit: 20, isPatient: false, q: 'mari' };
      accountsRepository.findPaginated.mockResolvedValue({
        rows: [
          {
            account_id: 'account-1',
            account_name: 'Maria Silva',
            account_email: 'maria@exemplo.com',
            account_status: AccountStatus.Inactive,
          },
        ],
        total: 21,
      });

      await expect(service.findAll(request)).resolves.toEqual({
        data: [
          {
            id: 'account-1',
            name: 'Maria Silva',
            email: 'maria@exemplo.com',
            status: AccountStatus.Inactive,
          },
        ],
        pagination: { page: 2, limit: 20, total: 21, totalPages: 2 },
      });
      expect(accountsRepository.findPaginated).toHaveBeenCalledWith(request);
    });

    it('returns an empty page with zero total pages', async () => {
      accountsRepository.findPaginated.mockResolvedValue({
        rows: [],
        total: 0,
      });

      await expect(service.findAll({ page: 1, limit: 20 })).resolves.toEqual({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    });

    it('returns a safe internal error when the repository fails', async () => {
      accountsRepository.findPaginated.mockRejectedValue(
        new Error('database connection details'),
      );
      const logError = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);

      await expect(
        service.findAll({ page: 1, limit: 20 }),
      ).rejects.toMatchObject({
        status: 500,
        response: {
          status: 'ERROR',
          message: 'Não foi possível consultar as contas.',
        },
      });
      expect(logError).toHaveBeenCalled();
    });
  });

  describe('isActive and isEmailDeactivated', () => {
    it('looks up an active account by id', async () => {
      accountRepository.exists.mockResolvedValue(true);

      await expect(service.isActive('account-1')).resolves.toBe(true);
      expect(accountRepository.exists).toHaveBeenCalledWith({
        where: { id: 'account-1', status: AccountStatus.Active },
      });
    });

    it('looks up an inactive account by the normalized e-mail', async () => {
      accountRepository.exists.mockResolvedValue(true);

      await expect(
        service.isEmailDeactivated(' Maria@Exemplo.com '),
      ).resolves.toBe(true);
      expect(accountRepository.exists).toHaveBeenCalledWith({
        where: { email: 'maria@exemplo.com', status: AccountStatus.Inactive },
      });
    });
  });

  describe('deactivate', () => {
    const deactivatedAt = new Date('2026-11-10T15:00:00.000Z');

    it('deactivates the account and revokes every session', async () => {
      accountsRepository.deactivate.mockResolvedValue({
        outcome: 'deactivated',
        supertokensUserId: 'st-1',
        deactivatedAt,
      });
      const revoke = jest
        .spyOn(Session, 'revokeAllSessionsForUser')
        .mockResolvedValue([]);

      await expect(service.deactivate('account-1', 'admin-1')).resolves.toEqual(
        {
          id: 'account-1',
          status: AccountStatus.Inactive,
          deactivatedAt: '2026-11-10T15:00:00.000Z',
        },
      );
      expect(accountsRepository.deactivate).toHaveBeenCalledWith(
        'account-1',
        'admin-1',
      );
      expect(revoke).toHaveBeenCalledWith('st-1');
    });

    it('still answers when the revocation fails, logging it', async () => {
      accountsRepository.deactivate.mockResolvedValue({
        outcome: 'deactivated',
        supertokensUserId: 'st-1',
        deactivatedAt,
      });
      jest
        .spyOn(Session, 'revokeAllSessionsForUser')
        .mockRejectedValue(new Error('core down'));
      const logError = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);

      await expect(
        service.deactivate('account-1', 'account-1'),
      ).resolves.toMatchObject({ status: AccountStatus.Inactive });
      expect(logError).toHaveBeenCalled();
    });

    it.each([
      [
        'not_found',
        404,
        { status: 'ACCOUNT_NOT_FOUND', message: 'Conta não encontrada.' },
      ],
      [
        'already_deactivated',
        409,
        {
          status: 'ACCOUNT_ALREADY_DEACTIVATED',
          message: 'A conta já está desativada.',
        },
      ],
      [
        'pts_responsible',
        409,
        {
          status: 'ACCOUNT_IS_PTS_RESPONSIBLE',
          message:
            'A conta tem perfil responsável por um PTS ativo. Transfira a responsabilidade antes de desativar.',
        },
      ],
    ] as const)(
      'maps %s to %i without revoking sessions',
      async (outcome, httpStatus, body) => {
        accountsRepository.deactivate.mockResolvedValue({ outcome });
        const revoke = jest.spyOn(Session, 'revokeAllSessionsForUser');

        await expect(
          service.deactivate('account-1', 'admin-1'),
        ).rejects.toMatchObject({ status: httpStatus, response: body });
        expect(revoke).not.toHaveBeenCalled();
      },
    );

    it('returns a safe internal error when the transaction fails', async () => {
      accountsRepository.deactivate.mockRejectedValue(
        new Error('database connection details'),
      );
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      await expect(
        service.deactivate('account-1', 'admin-1'),
      ).rejects.toMatchObject({
        status: 500,
        response: {
          status: 'ERROR',
          message: 'Não foi possível desativar a conta.',
        },
      });
    });
  });
});
