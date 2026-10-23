// Este arquivo expõe o endpoint autenticado de consulta de pacientes.
// O ValidationPipe global valida a query, e o controller delega a consulta
// ao PatientsService.

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentAccount } from '../../auth/decorators/current-account.decorator';
import { AuthGuard } from '../../auth/guards/auth.guard';
import type { AccountContext } from '../../accounts/services/accounts.service';
import { GetAuthorizedPatientsRequestDto } from '../dto/get-authorized-patients-request.dto';
import type { GetAuthorizedPatientsResponseDto } from '../dto/get-authorized-patients-response.dto';
import { PatientsService } from '../services/patients.service';

/**
 * Expõe a consulta autenticada de pacientes autorizados.
 */
@Controller()
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  /**
   * Retorna pacientes autorizados, filtrados por PTS ativo e paginados.
   *
   * O accountId é obtido do contexto autenticado, e o responsável do PTS
   * conta como membro da equipe, conforme a RN005.
   *
   * @param account contexto da conta autenticada
   * @param query parâmetros já normalizados
   * @returns pacientes autorizados e dados de paginação
   */
  @Get('patients/authorized')
  @UseGuards(AuthGuard)
  async findAuthorized(
    @CurrentAccount() account: AccountContext,
    @Query() query: GetAuthorizedPatientsRequestDto,
  ): Promise<GetAuthorizedPatientsResponseDto> {
    return this.patientsService.findAuthorized(account.accountId, query);
  }
}
