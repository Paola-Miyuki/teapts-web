import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger, NotFoundException } from '@nestjs/common';
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
    save: jest.fn<(value?: unknown) => unknown>(),
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

  describe('findAll', () => {
    it('passes the filters and returns only the public summary', async () => {
      const request = { page: 2, limit: 20, isPatient: false };
      accountsRepository.findPaginated.mockResolvedValue({
        rows: [{ account_id: 'account-1', account_name: 'Maria Silva' }],
        total: 21,
      });

      await expect(service.findAll(request)).resolves.toEqual({
        data: [{ id: 'account-1', name: 'Maria Silva' }],
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
