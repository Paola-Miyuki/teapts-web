// Este arquivo define o contrato público da listagem de contas.
// Só expõe o necessário para escolher a conta, sem a entidade Account.

import { ApiProperty } from '@nestjs/swagger';
import { PaginationResponseDto } from '../../common/pagination/pagination-response.dto';
import { AccountStatus } from '../enums/account-status.enum';

/** Dados necessários para identificar e selecionar uma conta. */
export class AccountSummaryResponseDto {
  id: string;
  name: string;
  /** @example maria@exemplo.com */
  email: string;
  /** Situação da conta; a desativada continua na lista do administrador. */
  @ApiProperty({ enum: AccountStatus, example: 'active' })
  status: AccountStatus;
}

/** Resposta paginada da listagem de contas. */
export class GetAccountsResponseDto {
  data: AccountSummaryResponseDto[];
  pagination: PaginationResponseDto;
}
