import { jest } from '@jest/globals';
import { Repository } from 'typeorm';
import { Account } from '../database/entities/account.entity';
import { AccountRole } from '../database/enums/account-role.enum';
import { AccountIntegrityError, AccountsService } from './accounts.service';

// A config do Jest roda em ESM, entao o objeto `jest` vem de @jest/globals.
function createService() {
  const accountRepository = {
    findOne: jest.fn<(options: unknown) => Promise<unknown>>(),
    create: jest.fn((data: Partial<Account>) => data),
    save: jest.fn(async (account: Partial<Account>) => ({
      id: 'account-1',
      ...account,
    })),
  };
  const service = new AccountsService(
    accountRepository as unknown as Repository<Account>,
  );

  return { accountRepository, service };
}

describe('AccountsService.resolveAccountContext', () => {
  it('returns the context with role and profiles from the relations', async () => {
    const { accountRepository, service } = createService();
    accountRepository.findOne.mockResolvedValue({
      id: 'account-1',
      supertokensUserId: 'user-1',
      role: AccountRole.User,
      patientProfile: { accountId: 'account-1' },
      professionalProfiles: [
        { id: 'professional-1' },
        { id: 'professional-2' },
      ],
    });

    await expect(service.resolveAccountContext('user-1')).resolves.toEqual({
      accountId: 'account-1',
      role: AccountRole.User,
      patientProfileId: 'account-1',
      professionalProfileIds: ['professional-1', 'professional-2'],
    });
    expect(accountRepository.findOne).toHaveBeenCalledWith({
      where: { supertokensUserId: 'user-1' },
      relations: { patientProfile: true, professionalProfiles: true },
    });
  });

  it('returns empty profiles when the account has none', async () => {
    const { accountRepository, service } = createService();
    accountRepository.findOne.mockResolvedValue({
      id: 'account-1',
      supertokensUserId: 'user-1',
      role: AccountRole.Admin,
      patientProfile: null,
      professionalProfiles: [],
    });

    await expect(service.resolveAccountContext('user-1')).resolves.toEqual({
      accountId: 'account-1',
      role: AccountRole.Admin,
      patientProfileId: null,
      professionalProfileIds: [],
    });
  });

  it('rejects a user without an account', async () => {
    const { accountRepository, service } = createService();
    accountRepository.findOne.mockResolvedValue(null);

    await expect(
      service.resolveAccountContext('missing-user'),
    ).rejects.toBeInstanceOf(AccountIntegrityError);
  });

  it.each([null, '', '   '])(
    'rejects an account with an invalid id: %p',
    async (id) => {
      const { accountRepository, service } = createService();
      accountRepository.findOne.mockResolvedValue({
        id,
        supertokensUserId: 'user-1',
        role: AccountRole.User,
        patientProfile: null,
        professionalProfiles: [],
      });

      await expect(
        service.resolveAccountContext('user-1'),
      ).rejects.toBeInstanceOf(AccountIntegrityError);
    },
  );
});

describe('AccountsService.createForSupertokensUser', () => {
  it('creates a user account linked to SuperTokens without a password', async () => {
    const { accountRepository, service } = createService();

    const account = await service.createForSupertokensUser({
      supertokensUserId: 'user-1',
      name: 'Maria',
      email: 'maria@example.com',
    });

    expect(accountRepository.create).toHaveBeenCalledWith({
      supertokensUserId: 'user-1',
      name: 'Maria',
      email: 'maria@example.com',
      role: AccountRole.User,
      lastUpdatedAt: null,
    });
    expect(account).toMatchObject({ id: 'account-1', role: AccountRole.User });
  });
});

describe('AccountsService.findById', () => {
  it('rejects a missing account', async () => {
    const { accountRepository, service } = createService();
    accountRepository.findOne.mockResolvedValue(null);

    await expect(service.findById('missing')).rejects.toThrow(
      'Conta não encontrada',
    );
  });
});
