import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { AccountRole } from '../database/enums/account-role.enum';
import { AccountsService } from './accounts.service';

describe('AccountsService', () => {
  const accountRepository = {
    create: jest.fn<(value?: unknown) => unknown>(),
    save: jest.fn<(value?: unknown) => unknown>(),
    findOne: jest.fn<(value?: unknown) => unknown>(),
  };
  let service: AccountsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AccountsService(accountRepository as never);
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
});
