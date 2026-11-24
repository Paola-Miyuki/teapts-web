import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  type ValidationOptions,
} from 'class-validator';

export const DEFAULT_PTS_PROPOSALS_PAGE = 1;
export const DEFAULT_PTS_PROPOSALS_LIMIT = 20;
export const MAX_PTS_PROPOSALS_LIMIT = 50;

function invalidParameter(
  parameter: 'patientId' | 'q' | 'page' | 'limit',
): ValidationOptions {
  return {
    message: `Parâmetro inválido: ${parameter}`,
    context: { status: 'VALIDATION_ERROR' },
  };
}

function toNumber(defaultValue: number) {
  return ({ value }: { value: unknown }): unknown => {
    if (value === undefined || value === '') {
      return defaultValue;
    }

    return Number(value);
  };
}

/** Texto opcional: espaços externos saem, e vazio equivale a sem filtro. */
function toOptionalText({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() || undefined : value;
}

export class GetPtsProposalsQueryDto {
  @ApiPropertyOptional({
    description:
      'ID da conta do paciente. Sem ele, o admin vê todas as propostas, o profissional as de que é responsável ou membro e o paciente as próprias.',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
  })
  @Transform(toOptionalText)
  @IsOptional()
  @IsUUID(undefined, invalidParameter('patientId'))
  patientId?: string;

  @ApiPropertyOptional({
    description:
      'Parte do nome ou do nome social do paciente, sem diferenciar maiúsculas.',
  })
  @Transform(toOptionalText)
  @IsOptional()
  @IsString(invalidParameter('q'))
  q?: string;

  @ApiPropertyOptional({
    type: 'integer',
    default: DEFAULT_PTS_PROPOSALS_PAGE,
    minimum: 1,
    description: 'Número da página',
  })
  @Transform(toNumber(DEFAULT_PTS_PROPOSALS_PAGE))
  @IsInt(invalidParameter('page'))
  @Min(1, invalidParameter('page'))
  page = DEFAULT_PTS_PROPOSALS_PAGE;

  @ApiPropertyOptional({
    type: 'integer',
    default: DEFAULT_PTS_PROPOSALS_LIMIT,
    minimum: 1,
    maximum: MAX_PTS_PROPOSALS_LIMIT,
    description: 'Quantidade de resultados por página',
  })
  @Transform(toNumber(DEFAULT_PTS_PROPOSALS_LIMIT))
  @IsInt(invalidParameter('limit'))
  @Min(1, invalidParameter('limit'))
  @Max(MAX_PTS_PROPOSALS_LIMIT, invalidParameter('limit'))
  limit = DEFAULT_PTS_PROPOSALS_LIMIT;
}
