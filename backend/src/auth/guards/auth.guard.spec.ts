import { jest } from '@jest/globals';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AccountsService } from '../../accounts/services/accounts.service';

type SessionMiddleware = (
  req: unknown,
  res: unknown,
  next: (error?: unknown) => void,
) => void;

jest.unstable_mockModule(
  'supertokens-node/recipe/session/framework/express',
  () => ({
    verifySession: jest.fn<(options?: unknown) => SessionMiddleware>(
      () => (req, _res, next) => {
        (req as { session?: unknown }).session = {
          getAccessTokenPayload: () => ({
            accountId: 'account-1',
            role: 'user',
            patientProfileId: null,
            professionalProfileIds: [],
          }),
        };
        next();
      },
    ),
  }),
);

let AuthGuard: (typeof import('./auth.guard.js'))['AuthGuard'];

beforeAll(async () => {
  ({ AuthGuard } = await import('./auth.guard.js'));
});

describe('AuthGuard', () => {
  const accountsService = {
    isActive: jest.fn<(accountId: string) => Promise<boolean>>(),
  };
  let request: { accountContext?: unknown };
  let context: ExecutionContext;

  beforeEach(() => {
    request = {};
    context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
      }),
    } as unknown as ExecutionContext;
  });

  it('stores the account context when the session is valid and the account is active', async () => {
    accountsService.isActive.mockResolvedValue(true);
    const guard = new AuthGuard(accountsService as unknown as AccountsService);

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(accountsService.isActive).toHaveBeenCalledWith('account-1');
    expect(request.accountContext).toMatchObject({ accountId: 'account-1' });
  });

  it('answers 401 for a deactivated account even with a valid session', async () => {
    accountsService.isActive.mockResolvedValue(false);
    const guard = new AuthGuard(accountsService as unknown as AccountsService);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(request.accountContext).toBeUndefined();
  });
});
