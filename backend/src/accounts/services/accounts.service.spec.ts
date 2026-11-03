import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { RecipeUserId } from 'supertokens-node';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import { AccountRole } from '../enums/account-role.enum';
import type {
  AccountsPage,
  AccountsQuery,
  AccountsRepository,
} from '../repositories/accounts.repository';
import { AccountsService } from './accounts.service';

describe('AccountsService', () => {
  const accountRepository = {
    create: jest.fn<(value?: unknown) => unknown>(),
    save: jest.fn<(value?: unknown) => Promise<unknown>>(),
    findOne: jest.fn<(value?: unknown) => unknown>(),
  };
  const accountsRepository = {
    findPaginated: jest.fn<(filters: AccountsQuery) => Promise<AccountsPage>>(),
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
      }),
    ).resolves.toBe(account);

    expect(accountRepository.create).toHaveBeenCalledWith({
      supertokensUserId: 'user-1',
      name: 'Pessoa Teste',
      email: 'pessoa@example.com',
      role: AccountRole.User,
      lastUpdatedAt: null,
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
          },
        ],
        total: 21,
      });

      await expect(service.findAll(request)).resolves.toEqual({
        data: [
          { id: 'account-1', name: 'Maria Silva', email: 'maria@exemplo.com' },
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
});
