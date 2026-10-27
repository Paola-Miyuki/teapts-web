// Este arquivo testa o guard que restringe a rota ao papel admin.

import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { AccountContext } from '../../accounts/services/accounts.service';
import { AccountRole } from '../../accounts/enums/account-role.enum';
import { AdminGuard } from './admin.guard';

function contextWith(accountContext?: AccountContext): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ accountContext }) }),
  } as unknown as ExecutionContext;
}

function account(role: AccountRole): AccountContext {
  return {
    accountId: 'account-1',
    role,
    patientProfileId: null,
    professionalProfileIds: [],
  };
}

describe('AdminGuard', () => {
  const guard = new AdminGuard();

  it('lets an admin through', () => {
    expect(guard.canActivate(contextWith(account(AccountRole.Admin)))).toBe(
      true,
    );
  });

  it('refuses a user with 403 FORBIDDEN', () => {
    let error: unknown;

    try {
      guard.canActivate(contextWith(account(AccountRole.User)));
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toEqual({
      status: 'FORBIDDEN',
      message: 'Acesso restrito ao administrador.',
    });
  });

  it('refuses with 401 when the AuthGuard did not validate the session', () => {
    expect(() => guard.canActivate(contextWith())).toThrow(
      UnauthorizedException,
    );
  });
});
