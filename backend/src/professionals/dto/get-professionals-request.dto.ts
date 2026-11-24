// Este arquivo define e normaliza os parâmetros da consulta de profissionais.
// A validação acontece no ValidationPipe global, antes do controller, para
// impedir que valores inválidos alcancem a consulta ao banco.

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  type ValidationOptions,
} from 'class-validator';
import {
  invalidParameter,
  PaginationQueryDto,
} from '../../common/pagination/pagination-query.dto';
import { Specialism } from '../enums/specialism.enum';
import { UFS, type Uf } from '../enums/uf.enum';
import { COUNCILS, type Council } from '../professional-registration';

/** Identificador UUID de um perfil profissional. */
export type ProfessionalId = string;

/** Valores de especialidade aceitos pelo contrato da consulta. */
export type ProfessionalSpecialism = Specialism;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const PROFESSIONAL_SORT_FIELDS = ['name', 'specialism'] as const;
export type ProfessionalSortField = (typeof PROFESSIONAL_SORT_FIELDS)[number];

export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

function invalidEach(parameter: string): ValidationOptions {
  return { ...invalidParameter(parameter), each: true };
}

/** Texto opcional: espaços externos saem, e vazio equivale a sem filtro. */
function toOptionalText({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() || undefined : value;
}

/** Aceita `a,b` ou `a&a=b`; vazio equivale a sem filtro. */
function toList({ value }: { value: unknown }): unknown {
  if (value === undefined) {
    return undefined;
  }

  const values = (Array.isArray(value) ? value : [value])
    .flatMap((item) => (typeof item === 'string' ? item.split(',') : [item]))
    .map((item) => (typeof item === 'string' ? item.trim() : item))
    .filter((item) => item !== '');

  return values.length > 0 ? [...new Set(values)] : undefined;
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
export class GetProfessionalsRequestDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Parte do nome, do e-mail ou do nº de registro no conselho, sem diferenciar maiúsculas; vazio equivale a sem busca.',
  })
  @Transform(toOptionalText)
  @IsOptional()
  @IsString(invalidParameter('q'))
  q?: string;

  @ApiPropertyOptional({
    description: 'Especialidades, separadas por vírgula.',
    enum: Specialism,
    isArray: true,
  })
  @Transform(toList)
  @IsOptional()
  @IsEnum(Specialism, invalidEach('specialism'))
  specialism?: Specialism[];

  @ApiPropertyOptional({
    description: 'Conselhos regionais, separados por vírgula.',
    enum: COUNCILS,
    isArray: true,
  })
  @Transform(toList)
  @IsOptional()
  @IsIn(COUNCILS, invalidEach('council'))
  council?: Council[];

  @ApiPropertyOptional({
    description: 'UF do registro no conselho.',
    enum: UFS,
  })
  @Transform(toOptionalText)
  @IsOptional()
  @IsIn(UFS, invalidParameter('councilState'))
  councilState?: Uf;

  @ApiPropertyOptional({ enum: PROFESSIONAL_SORT_FIELDS, default: 'name' })
  @Transform(toOptionalText)
  @IsOptional()
  @IsIn(PROFESSIONAL_SORT_FIELDS, invalidParameter('sort'))
  sort?: ProfessionalSortField;

  @ApiPropertyOptional({ enum: SORT_ORDERS, default: 'asc' })
  @Transform(toOptionalText)
  @IsOptional()
  @IsIn(SORT_ORDERS, invalidParameter('order'))
  order?: SortOrder;

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
