import { Repository } from 'typeorm';
import {
  AccountIntegrityError,
  AccountsService,
} from './accounts.service';
import { Account } from './account.entity';

describe('AccountsService.resolveAccountContext', () => {
  let accountRepository: {
    findOne: jest.Mock;
  };
  let service: AccountsService;

  beforeEach(() => {
    accountRepository = {
      findOne: jest.fn(),
    };
    service = new AccountsService(
      accountRepository as unknown as Repository<Account>,
    );
  });

  it('returns the context for an existing account', async () => {
    accountRepository.findOne.mockResolvedValue({
      id: 'account-1',
      supertokensUserId: 'user-1',
      patientProfileId: null,
      professionalProfileIds: ['professional-1'],
    });

    await expect(service.resolveAccountContext('user-1')).resolves.toEqual({
      accountId: 'account-1',
      patientProfileId: null,
      professionalProfileIds: ['professional-1'],
    });
  });

  it('rejects a user without an account', async () => {
    accountRepository.findOne.mockResolvedValue(null);

    await expect(
      service.resolveAccountContext('missing-user'),
    ).rejects.toBeInstanceOf(AccountIntegrityError);
  });

  it.each([null, '', '   '])(
    'rejects an account with an invalid id: %p',
    async (id) => {
      accountRepository.findOne.mockResolvedValue({
        id,
        supertokensUserId: 'user-1',
        patientProfileId: null,
        professionalProfileIds: [],
      });

      await expect(
        service.resolveAccountContext('user-1'),
      ).rejects.toBeInstanceOf(AccountIntegrityError);
    },
  );
});
