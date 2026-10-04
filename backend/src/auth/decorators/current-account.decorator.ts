// Este arquivo define o decorator usado pelos controllers protegidos.
// Ele entrega o contexto já validado pelo AuthGuard.
// O controller não precisa conhecer cookies nem a estrutura interna da sessão.
// Se o guard não tiver preparado o contexto, a requisição é recusada.

import {
  UnauthorizedException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AccountContext } from '../../accounts/accounts.service';

type AuthenticatedRequest = Request & {
  accountContext?: AccountContext;
};

/**
 * Lê o contexto salvo no payload do access token e o entrega ao controller.
 *
 * O decorator evita que cada endpoint precise conhecer os detalhes internos
 * de como a sessão do SuperTokens é armazenada na requisição.
 *
 * Exemplo:
 * @UseGuards(AuthGuard)
 * @Get('me')
 * me(@CurrentAccount() account: AccountContext) { ... }
 *
 * @returns decorator que entrega AccountContext ao parâmetro do controller
 * @throws UnauthorizedException quando o guard não validou a sessão
 */
export const CurrentAccount = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AccountContext => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.accountContext) {
      throw new UnauthorizedException('Sessão não validada');
    }

    return request.accountContext;
  },
);
