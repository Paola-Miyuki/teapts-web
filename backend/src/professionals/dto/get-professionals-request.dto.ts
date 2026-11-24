// Este arquivo define e normaliza os parâmetros da consulta de profissionais.
// A validação acontece no ValidationPipe global, antes do controller, para
// impedir que valores inválidos alcancem a consulta ao banco.

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import {
  invalidParameter,
  PaginationQueryDto,
} from '../../common/pagination/pagination-query.dto';
import { Specialism } from '../enums/specialism.enum';

/** Identificador UUID de um perfil profissional. */
export type ProfessionalId = string;

/** Valores de especialidade aceitos pelo contrato da consulta. */
export type ProfessionalSpecialism = Specialism;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
export class GetProfessionalsRequestDto extends PaginationQueryDto {
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
