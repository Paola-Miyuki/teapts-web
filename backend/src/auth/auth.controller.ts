// Este arquivo expõe as rotas de autenticação próprias da aplicação.
// O login continua sendo o POST /auth/signin oficial do SuperTokens.
// Aqui existe apenas GET /me, que consulta a conta da sessão já validada.
// Não há endpoint de login próprio para evitar duplicar regras de autenticação.

import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from './guards/auth.guard';
import { CurrentAccount } from './decorators/current-account.decorator';
import { AccountsService } from '../accounts/accounts.service';
import type { AccountContext } from '../accounts/accounts.service';

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
}
