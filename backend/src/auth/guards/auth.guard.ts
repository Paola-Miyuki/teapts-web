// Este arquivo adapta o middleware de sessão do SuperTokens ao NestJS.
// O guard valida o access token antes de executar o controller.
// Depois da validação, guarda o contexto da conta na requisição.
// Assim o controller pode usar @CurrentAccount() sem repetir essa leitura.

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Response } from 'express';
import { verifySession } from 'supertokens-node/recipe/session/framework/express';
import type { SessionRequest } from 'supertokens-node/framework/express';
import { parseAccountContext } from '../account-context';
import type { AccountContext } from '../../accounts/accounts.service';

type AuthenticatedRequest = SessionRequest & {
  accountContext?: AccountContext;
};

/**
 * Adapta o middleware `verifySession` do SuperTokens ao contrato de guard
 * do NestJS e bloqueia a rota quando o cookie de sessão é inválido.
 *
 * Exemplo:
 * @UseGuards(AuthGuard)
 * @Get('me')
 * me(@CurrentAccount() account: AccountContext) { ... }
 */
@Injectable()
export class AuthGuard implements CanActivate {
  // middleware oficial do SuperTokens, reaproveitado dentro do guard
  private readonly verify = verifySession();

  /**
   * Valida a sessão antes de permitir a execução do controller.
   *
   * @param context contexto HTTP do NestJS
   * @returns true quando a sessão e o contexto são válidos
   * @throws erro de sessão ou UnauthorizedException quando a validação falha
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<AuthenticatedRequest>();
    const res = http.getResponse<Response>();

    // verifySession valida o access token e injeta req.session.
    // Se a sessão for inválida, chama next(err) com um erro do SuperTokens,
    // que o SupertokensExceptionFilter converte em 401.
    await new Promise<void>((resolve, reject) => {
      void this.verify(req, res, (err) => (err ? reject(err) : resolve()));
    });

    const session = req.session;
    const payload = session?.getAccessTokenPayload();
    req.accountContext = parseAccountContext(payload);

    return true;
  }
}
