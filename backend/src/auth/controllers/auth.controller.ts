// Este arquivo expõe as rotas de autenticação próprias da aplicação.
// O login continua sendo o POST /auth/signin oficial do SuperTokens.
// Aqui existem GET /me, que consulta a conta da sessão já validada, e
// POST /auth/logout, que substitui o /auth/signout do SDK (desligado).
// Não há endpoint de login próprio para evitar duplicar regras de autenticação.

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { SessionRequest } from 'supertokens-node/framework/express';
import { AuthGuard } from '../guards/auth.guard';
import { CurrentAccount } from '../decorators/current-account.decorator';
import { LogoutRequestDto } from '../dto/logout-request.dto';
import { processLogout } from '../services/supertokens.service';
import { AccountsService } from '../../accounts/services/accounts.service';
import type { AccountContext } from '../../accounts/services/accounts.service';

/**
 * Expõe endpoints da aplicação que dependem de uma sessão válida.
 *
 * @param accountsService serviço que busca os dados atuais da conta
 */
@Controller()
export class AuthController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get('me')
  @UseGuards(AuthGuard)
  /**
   * Retorna os dados da conta atual, identificada pelo contexto da sessão.
   *
   * O contexto vai na sessão para evitar uma consulta ao banco a cada
   * requisição protegida; o banco ainda é consultado aqui para dados atuais.
   *
   * @param account contexto validado pelo AuthGuard e entregue pelo decorator
   * @returns dados públicos da conta atual
   * @throws UnauthorizedException quando a conta não pode ser encontrada
   */
  async getMe(@CurrentAccount() account: AccountContext) {
    const accountDetails = await this.accountsService.findById(
      account.accountId,
    );

    return {
      accountId: account.accountId,
      name: accountDetails.name,
      email: accountDetails.email,
      role: accountDetails.role,
      patientProfileId: account.patientProfileId,
      professionalProfileIds: account.professionalProfileIds,
    };
  }

  @Post('auth/logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  /**
   * Encerra a sessão atual e, com `allSessions: true`, todas as do usuário.
   *
   * O AuthGuard valida a sessão no banco (checkDatabase), então uma sessão já
   * revogada recebe 401, que o frontend trata como logout concluído.
   *
   * @param req requisição com a sessão anexada pelo AuthGuard
   * @param body corpo validado pelo ValidationPipe global
   * @returns `{ status: 'OK' }`, o mesmo corpo do signout do SDK
   * @throws UnauthorizedException quando não há sessão na requisição
   */
  async logout(@Req() req: SessionRequest, @Body() body: LogoutRequestDto) {
    if (!req.session) {
      throw new UnauthorizedException('Sessão não validada');
    }

    await processLogout(req.session, body.allSessions === true);

    return { status: 'OK' };
  }
}
