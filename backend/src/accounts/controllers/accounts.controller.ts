// Este arquivo expõe a listagem de contas, restrita ao administrador.
// O ValidationPipe global valida a query, e o controller delega a consulta
// ao AccountsService.

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthGuard } from '../../auth/guards/auth.guard';
import {
  ErrorResponseDto,
  UnauthorizedResponseDto,
} from '../../common/swagger/error-response.dto';
import { GetAccountsRequestDto } from '../dto/get-accounts-request.dto';
import { GetAccountsResponseDto } from '../dto/get-accounts-response.dto';
import { AccountsService } from '../services/accounts.service';

/**
 * Expõe a listagem de contas para o administrador escolher a conta.
 */
@ApiTags('accounts')
@Controller()
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  /**
   * Retorna as contas (id e nome) paginadas, com filtros opcionais de perfil
   * de paciente e de perfil profissional.
   *
   * @param query parâmetros já normalizados
   * @returns contas e dados de paginação
   */
  @Get('accounts')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiCookieAuth()
  @ApiBearerAuth()
  @ApiOkResponse({ type: GetAccountsResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    example: { status: 'ERROR', message: 'Parâmetro inválido: isPatient' },
  })
  @ApiUnauthorizedResponse({ type: UnauthorizedResponseDto })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    example: {
      status: 'FORBIDDEN',
      message: 'Acesso restrito ao administrador.',
    },
  })
  @ApiInternalServerErrorResponse({
    type: ErrorResponseDto,
    example: {
      status: 'ERROR',
      message: 'Não foi possível consultar as contas.',
    },
  })
  async findAll(
    @Query() query: GetAccountsRequestDto,
  ): Promise<GetAccountsResponseDto> {
    return this.accountsService.findAll(query);
  }
}
