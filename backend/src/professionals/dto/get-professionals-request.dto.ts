// Este arquivo define e normaliza os parâmetros da consulta de profissionais.
// A validação acontece no ValidationPipe global, antes do controller, para
// impedir que valores inválidos alcancem a consulta ao banco.

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  type ValidationOptions,
} from 'class-validator';
import { Specialism } from '../enums/specialism.enum';

/** Página usada quando a consulta não informa paginação. */
export const DEFAULT_PROFESSIONALS_PAGE = 1;

/** Quantidade de profissionais retornada por página por padrão. */
export const DEFAULT_PROFESSIONALS_LIMIT = 10;

/** Maior quantidade de profissionais permitida em uma página. */
export const MAX_PROFESSIONALS_LIMIT = 100;

/** Identificador UUID de um perfil profissional. */
export type ProfessionalId = string;

/** Valores de especialidade aceitos pelo contrato da consulta. */
export type ProfessionalSpecialism = Specialism;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Mensagem e status do erro de um parâmetro de consulta inválido. */
function invalidParameter(parameter: string): ValidationOptions {
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

/** Remove espaços externos do nome; só espaços viram texto vazio (inválido). */
function trimName({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/** Trata a especialidade vazia como filtro não informado. */
function emptyToUndefined({ value }: { value: unknown }): unknown {
  return value === '' ? undefined : value;
}

/**
 * Converte a lista de IDs da query para valores únicos e sem espaços.
 *
 * Aceita uma string separada por vírgulas ou a lista produzida pelo
 * adaptador HTTP. Sem nenhum valor, o filtro não é aplicado.
 */
function toIdList({ value }: { value: unknown }): unknown {
  if (value === undefined) {
    return undefined;
  }

  const values = (Array.isArray(value) ? value : [value])
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim())
    .filter((item) => item !== '');

  const uniqueIds = [...new Set(values)];

  return uniqueIds.length === 0 ? undefined : uniqueIds;
}

/**
 * Parâmetros da consulta de profissionais, já normalizados pelo pipe.
 *
 * A ordem das propriedades define a ordem da validação: o primeiro
 * parâmetro inválido é o reportado no erro.
 */
export class GetProfessionalsRequestDto {
  // page e limit têm valor padrão, então são opcionais na query; o plugin
  // os marcaria como obrigatórios por não terem `?`.
  @ApiPropertyOptional({
    type: 'integer',
    default: DEFAULT_PROFESSIONALS_PAGE,
    minimum: 1,
  })
  @Transform(toPageNumber(DEFAULT_PROFESSIONALS_PAGE))
  @IsInt(invalidParameter('page'))
  @Min(1, invalidParameter('page'))
  page: number = DEFAULT_PROFESSIONALS_PAGE;

  @ApiPropertyOptional({
    type: 'integer',
    default: DEFAULT_PROFESSIONALS_LIMIT,
    minimum: 1,
    maximum: MAX_PROFESSIONALS_LIMIT,
  })
  @Transform(toPageNumber(DEFAULT_PROFESSIONALS_LIMIT))
  @IsInt(invalidParameter('limit'))
  @Min(1, invalidParameter('limit'))
  @Max(MAX_PROFESSIONALS_LIMIT, invalidParameter('limit'))
  limit: number = DEFAULT_PROFESSIONALS_LIMIT;

  @Transform(trimName)
  @IsOptional()
  @IsString(invalidParameter('name'))
  @IsNotEmpty(invalidParameter('name'))
  name?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsEnum(Specialism, invalidParameter('specialism'))
  specialism?: Specialism;

  @ApiPropertyOptional({
    type: String,
    description: 'UUIDs separados por vírgula.',
    example:
      '7d0e8f2a-1c3b-4d5e-8f90-a1b2c3d4e5f6,0f1e2d3c-4b5a-4987-8a6b-5c4d3e2f1a0b',
  })
  @Transform(toIdList)
  @IsOptional()
  @Matches(UUID_PATTERN, { ...invalidParameter('ids'), each: true })
  ids?: ProfessionalId[];
}
