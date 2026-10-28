// Este arquivo descreve o bloco `pagination` das respostas paginadas.
// É classe, e não interface, para aparecer no OpenAPI.

/** Dados da paginação de uma listagem. */
export class PaginationResponseDto {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
