// Este arquivo monta o bloco `pagination` das respostas paginadas.

import type { PaginationResponseDto } from './pagination-response.dto';

/**
 * Monta os dados da paginação a partir da query e do total encontrado.
 *
 * @param query página e limite já validados
 * @param total quantidade total de itens da consulta
 * @returns página, limite, total e quantidade de páginas
 */
export function toPagination(
  query: { page: number; limit: number },
  total: number,
): PaginationResponseDto {
  return {
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.ceil(total / query.limit),
  };
}
