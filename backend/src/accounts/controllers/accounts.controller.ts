// Este arquivo expõe a listagem de contas, restrita ao administrador.
// O ValidationPipe global valida a query, e o controller delega a consulta
// ao AccountsService.

import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentAccount } from '../../auth/decorators/current-account.decorator';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthGuard } from '../../auth/guards/auth.guard';
import {
  ErrorResponseDto,
  UnauthorizedResponseDto,
} from '../../common/swagger/error-response.dto';
import { DeactivateAccountResponseDto } from '../dto/deactivate-account-response.dto';
import { GetAccountsRequestDto } from '../dto/get-accounts-request.dto';
import { GetAccountsResponseDto } from '../dto/get-accounts-response.dto';
import {
  type AccountContext,
  AccountsService,
} from '../services/accounts.service';

const parseAccountId = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException({
      status: 'VALIDATION_ERROR',
      message: 'Parâmetro inválido: id',
    }),
});

/**
 * Expõe a listagem de contas para o administrador escolher a conta.
 */
@ApiTags('accounts')
@Controller()
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  /**
   * Retorna as contas de usuário (id, nome e e-mail) paginadas, com a busca
   * `q` por nome ou e-mail e os filtros opcionais de perfil de paciente e de
   * perfil profissional. Contas de admin nunca aparecem.
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

  /**
   * Desativa a conta (exclusão lógica, RFAUT005, RN021). Também desativa o
   * profissional (RFPRO004). Só o administrador usa esta rota; o titular usa
   * `DELETE /me`.
   *
   * @param id conta a desativar
   * @param account contexto do administrador
   * @returns id, situação e momento da desativação
   */
  @Delete('accounts/:id')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiCookieAuth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Desativa uma conta (exclusão lógica)' })
  @ApiOkResponse({ type: DeactivateAccountResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    example: { status: 'VALIDATION_ERROR', message: 'Parâmetro inválido: id' },
  })
  @ApiUnauthorizedResponse({ type: UnauthorizedResponseDto })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    example: {
      status: 'FORBIDDEN',
      message: 'Acesso restrito ao administrador.',
    },
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    example: { status: 'ACCOUNT_NOT_FOUND', message: 'Conta não encontrada.' },
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    examples: {
      alreadyDeactivated: {
        summary: 'Conta já desativada',
        value: {
          status: 'ACCOUNT_ALREADY_DEACTIVATED',
          message: 'A conta já está desativada.',
        },
      },
      ptsResponsible: {
        summary: 'Responsável por PTS ativo',
        value: {
          status: 'ACCOUNT_IS_PTS_RESPONSIBLE',
          message:
            'A conta tem perfil responsável por um PTS ativo. Transfira a responsabilidade antes de desativar.',
        },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    type: ErrorResponseDto,
    example: {
      status: 'ERROR',
      message: 'Não foi possível desativar a conta.',
    },
  })
  async deactivate(
    @Param('id', parseAccountId) id: string,
    @CurrentAccount() account: AccountContext,
  ): Promise<DeactivateAccountResponseDto> {
    return this.accountsService.deactivate(id, account.accountId);
  }
}
