// Este arquivo restringe uma rota ao papel admin.
// Roda depois do AuthGuard, que guarda o contexto da conta na requisição:
// @UseGuards(AuthGuard, AdminGuard).

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AccountContext } from '../../accounts/services/accounts.service';
import { AccountRole } from '../../accounts/enums/account-role.enum';

type AuthenticatedRequest = Request & {
  accountContext?: AccountContext;
};

@Injectable()
export class AdminGuard implements CanActivate {
  /**
   * Libera a requisição só para contas com papel admin.
   *
   * @param context contexto da requisição, já validada pelo AuthGuard
   * @returns true quando a conta é admin
   * @throws UnauthorizedException quando o AuthGuard não validou a sessão
   * @throws ForbiddenException `FORBIDDEN` quando a conta não é admin
   */
  canActivate(context: ExecutionContext): boolean {
    const { accountContext } = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();

    if (!accountContext) {
      throw new UnauthorizedException('Sessão não validada');
    }

    if (accountContext.role !== AccountRole.Admin) {
      throw new ForbiddenException({
        status: 'FORBIDDEN',
        message: 'Acesso restrito ao administrador.',
      });
    }

    return true;
  }
}
