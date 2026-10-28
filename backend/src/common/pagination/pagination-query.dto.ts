// Este arquivo define a paginação de query compartilhada pelas listagens.
// Os DTOs de cada rota estendem PaginationQueryDto e acrescentam os próprios
// filtros. Os erros saem `{ status: 'ERROR', message: 'Parâmetro inválido: <param>' }`.

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, Max, Min, type ValidationOptions } from 'class-validator';

/** Página usada quando a query não informa paginação. */
export const DEFAULT_PAGE = 1;

/** Quantidade de itens por página quando a query não informa o `limit`. */
export const DEFAULT_PAGE_LIMIT = 20;

/** Maior `limit` aceito (NF: listagens paginadas em até 50 itens). */
export const MAX_PAGE_LIMIT = 50;

/**
 * Mensagem e status do erro de um parâmetro de query inválido.
 *
 * @param parameter nome do parâmetro, repetido na mensagem
 * @returns opções de validação com `context.status` igual a `ERROR`
 */
export function invalidParameter(parameter: string): ValidationOptions {
  return {
    message: `Parâmetro inválido: ${parameter}`,
    context: { status: 'ERROR' },
  };
}

/** Converte a paginação da query, usando o padrão quando vier vazia. */
function toPageNumber(defaultValue: number) {
  return ({ value }: { value: unknown }): unknown =>
    value === undefined || value === '' ? defaultValue : Number(value);
}

/**
 * Paginação da query, normalizada pelo ValidationPipe global.
 */
export class PaginationQueryDto {
  // page e limit têm valor padrão, então são opcionais na query; o plugin
  // os marcaria como obrigatórios por não terem `?`.
  @ApiPropertyOptional({ type: 'integer', default: DEFAULT_PAGE, minimum: 1 })
  @Transform(toPageNumber(DEFAULT_PAGE))
  @IsInt(invalidParameter('page'))
  @Min(1, invalidParameter('page'))
  page: number = DEFAULT_PAGE;

  @ApiPropertyOptional({
    type: 'integer',
    default: DEFAULT_PAGE_LIMIT,
    minimum: 1,
    maximum: MAX_PAGE_LIMIT,
  })
  @Transform(toPageNumber(DEFAULT_PAGE_LIMIT))
  @IsInt(invalidParameter('limit'))
  @Min(1, invalidParameter('limit'))
  @Max(MAX_PAGE_LIMIT, invalidParameter('limit'))
  limit: number = DEFAULT_PAGE_LIMIT;
}
