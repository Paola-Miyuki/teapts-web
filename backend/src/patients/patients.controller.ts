// Este arquivo expõe o endpoint autenticado de pacientes autorizados.

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentAccount } from '../auth/decorators/current-account.decorator';
import type { AccountContext } from '../accounts/accounts.service';
import {
  type GetAuthorizedPatientsQuery,
  normalizeGetAuthorizedPatientsQuery,
} from './dto/get-authorized-patients-request.dto';
import type { GetAuthorizedPatientsResponseDto } from './dto/get-authorized-patients-response.dto';
import { PatientsService } from './patients.service';

@Controller()
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get('patients/authorized')
  @UseGuards(AuthGuard)
  async findAuthorized(
    @CurrentAccount() account: AccountContext,
    @Query() query: GetAuthorizedPatientsQuery,
  ): Promise<GetAuthorizedPatientsResponseDto> {
    return this.patientsService.findAuthorized(
      account.accountId,
      normalizeGetAuthorizedPatientsQuery(query),
    );
  }
}
