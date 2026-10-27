// Este arquivo adapta o middleware de sessão do SuperTokens ao NestJS.
// O guard valida o access token antes de executar o controller.
// Depois da validação, guarda o contexto da conta na requisição.

import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Response } from 'express';
import {
  verifySession,
} from 'supertokens-node/recipe/session/framework/express';
import type { SessionRequest } from 'supertokens-node/framework/express';

import { parseAccountContext } from '../account-context';
import type { AccountContext } from '../../accounts/services/accounts.service';

type AuthenticatedRequest = SessionRequest & {
  accountContext?: AccountContext;
};

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly verify = verifySession({
    checkDatabase: true,
  });

 async canActivate(context: ExecutionContext): Promise<boolean> {
  console.log('[AuthGuard] entrou no canActivate');

  const http = context.switchToHttp();
  const req = http.getRequest<AuthenticatedRequest>();
  const res = http.getResponse<Response>();


    // Valida a sessão do SuperTokens.
    await new Promise<void>((resolve, reject) => {
      void this.verify(req, res, (err) =>
        err ? reject(err) : resolve(),
      );
    });

    console.log('[AuthGuard] verifySession passou');

    // Obtém o payload da sessão validada.
    const session = req.session;
    const payload = session?.getAccessTokenPayload();

    // Valida e armazena o contexto da conta.
    req.accountContext = parseAccountContext(payload);

    console.log(
      '[AuthGuard] contexto definido:',
      Boolean(req.accountContext),
    );

    return true;
  }
}