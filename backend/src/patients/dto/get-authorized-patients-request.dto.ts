// Este arquivo define e valida os parâmetros da consulta de pacientes autorizados.

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, Max, Min, type ValidationOptions } from 'class-validator';

export const DEFAULT_AUTHORIZED_PATIENTS_PAGE = 1;
export const DEFAULT_AUTHORIZED_PATIENTS_LIMIT = 10;
export const MAX_AUTHORIZED_PATIENTS_LIMIT = 100;

/** Mensagem e status do erro de um parâmetro de consulta inválido. */
function invalidParameter(parameter: 'page' | 'limit'): ValidationOptions {
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
 * Parâmetros da consulta de pacientes autorizados, normalizados pelo pipe.
 *
 * Não usa o PaginationQueryDto (máximo 50) porque o `pts/novo` pede
 * `limit=100`.
 */
export class GetAuthorizedPatientsRequestDto {
  // page e limit têm valor padrão, então são opcionais na query; o plugin
  // os marcaria como obrigatórios por não terem `?`.
  @ApiPropertyOptional({
    type: 'integer',
    default: DEFAULT_AUTHORIZED_PATIENTS_PAGE,
    minimum: 1,
  })
  @Transform(toPageNumber(DEFAULT_AUTHORIZED_PATIENTS_PAGE))
  @IsInt(invalidParameter('page'))
  @Min(1, invalidParameter('page'))
  page: number = DEFAULT_AUTHORIZED_PATIENTS_PAGE;

  @ApiPropertyOptional({
    type: 'integer',
    default: DEFAULT_AUTHORIZED_PATIENTS_LIMIT,
    minimum: 1,
    maximum: MAX_AUTHORIZED_PATIENTS_LIMIT,
  })
  @Transform(toPageNumber(DEFAULT_AUTHORIZED_PATIENTS_LIMIT))
  @IsInt(invalidParameter('limit'))
  @Min(1, invalidParameter('limit'))
  @Max(MAX_AUTHORIZED_PATIENTS_LIMIT, invalidParameter('limit'))
  limit: number = DEFAULT_AUTHORIZED_PATIENTS_LIMIT;
}
