// Este arquivo define o contrato público da listagem de contas.
// Só expõe o necessário para escolher a conta, sem a entidade Account.

import { PaginationResponseDto } from '../../common/pagination/pagination-response.dto';

/** Dados necessários para identificar e selecionar uma conta. */
export class AccountSummaryResponseDto {
  id: string;
  name: string;
}

/** Resposta paginada da listagem de contas. */
export class GetAccountsResponseDto {
  data: AccountSummaryResponseDto[];
  pagination: PaginationResponseDto;
}
