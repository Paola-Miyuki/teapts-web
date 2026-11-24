// Este arquivo define e valida os parâmetros da consulta de pacientes
// disponíveis para um PTS novo (busca por nome; a busca completa é da #80).

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import {
  invalidParameter,
  PaginationQueryDto,
} from '../../common/pagination/pagination-query.dto';

/** Nome opcional: espaços externos saem, e vazio equivale a sem busca. */
function toSearchName({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim() || undefined;
}

export class GetAvailablePatientsRequestDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Parte do nome do paciente, sem diferenciar maiúsculas; vazio equivale a sem busca.',
  })
  @Transform(toSearchName)
  @IsOptional()
  @IsString(invalidParameter('name'))
  name?: string;
}
