import { UnauthorizedException } from '@nestjs/common';
import { AccountRole } from '../database/enums/account-role.enum';
import { parseAccountContext } from './account-context';

describe('parseAccountContext', () => {
  it('returns a valid account context', () => {
    const context = parseAccountContext({
      accountId: 'account-1',
      role: 'admin',
      patientProfileId: null,
      professionalProfileIds: ['professional-1'],
    });

    expect(context).toEqual({
      accountId: 'account-1',
      role: AccountRole.Admin,
      patientProfileId: null,
      professionalProfileIds: ['professional-1'],
    });
  });

  it.each([null, undefined, 'invalid'])(
    'rejects a non-object payload: %p',
    (payload) => {
      expect(() => parseAccountContext(payload)).toThrow(UnauthorizedException);
    },
  );

  it('rejects an empty account id', () => {
    expect(() =>
      parseAccountContext({
        accountId: '   ',
        role: 'user',
        patientProfileId: null,
        professionalProfileIds: [],
      }),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a professional profile id that is not a string', () => {
    expect(() =>
      parseAccountContext({
        accountId: 'account-1',
        role: 'user',
        patientProfileId: null,
        professionalProfileIds: ['professional-1', 42],
      }),
    ).toThrow(UnauthorizedException);
  });

  it.each([undefined, 'superuser'])(
    'rejects a missing or unknown role: %p',
    (role) => {
      expect(() =>
        parseAccountContext({
          accountId: 'account-1',
          role,
          patientProfileId: null,
          professionalProfileIds: [],
        }),
      ).toThrow(UnauthorizedException);
    },
  );
});
