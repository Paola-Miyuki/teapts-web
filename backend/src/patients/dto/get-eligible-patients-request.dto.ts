// Este arquivo define e valida os parâmetros da busca de pacientes elegíveis
// para uma nova proposta de PTS (RFPTS001, RN011).

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Equals, IsOptional, IsString, MinLength } from 'class-validator';
import {
  invalidParameter,
  PaginationQueryDto,
} from '../../common/pagination/pagination-query.dto';

/** Menor termo de busca aceito (NFUS003). */
export const MIN_SEARCH_LENGTH = 2;

/** Texto opcional: espaços externos saem, e vazio equivale a sem busca. */
function toOptionalText({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim() || undefined;
}

export class GetEligiblePatientsRequestDto extends PaginationQueryDto {
  @ApiProperty({
    description:
      'Deve ser `false`: só pacientes sem PTS em planejamento ou em andamento e sem rascunho (RN011).',
    enum: ['false'],
  })
  @Equals('false', invalidParameter('withActivePts'))
  withActivePts: string;

  @ApiPropertyOptional({
    description:
      'Parte do nome, do nome social, do e-mail ou do CPF (com ou sem pontuação), sem diferenciar maiúsculas; mínimo de 2 caracteres; vazio equivale a sem busca.',
    minLength: MIN_SEARCH_LENGTH,
  })
  @Transform(toOptionalText)
  @IsOptional()
  @IsString(invalidParameter('q'))
  @MinLength(MIN_SEARCH_LENGTH, invalidParameter('q'))
  q?: string;
}
