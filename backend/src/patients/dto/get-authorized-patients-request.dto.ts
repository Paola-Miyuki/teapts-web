// Este arquivo define e valida os parâmetros da consulta de pacientes autorizados.

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  type ValidationOptions,
} from 'class-validator';
import {
  invalidParameter,
  PaginationQueryDto,
} from '../../common/pagination/pagination-query.dto';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';

/** Status do PTS de um paciente na lista; `none` é o paciente sem PTS. */
export const PATIENT_PTS_STATUS_FILTERS = [
  ...Object.values(PtsStateEnum),
  'none',
] as const;
export type PatientPtsStatusFilter =
  (typeof PATIENT_PTS_STATUS_FILTERS)[number];

export const PATIENT_SORT_FIELDS = ['name', 'registeredAt'] as const;
export type PatientSortField = (typeof PATIENT_SORT_FIELDS)[number];

export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function invalidEach(parameter: string): ValidationOptions {
  return { ...invalidParameter(parameter), each: true };
}

/** Texto opcional: espaços externos saem, e vazio equivale a sem filtro. */
function toOptionalText({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim() || undefined;
}

/** Aceita `status=a,b` ou `status=a&status=b`; vazio equivale a sem filtro. */
function toStatusList({ value }: { value: unknown }): unknown {
  if (value === undefined) {
    return undefined;
  }

  const values = (Array.isArray(value) ? value : [value]).flatMap((item) =>
    typeof item === 'string' ? item.split(',') : [item],
  );
  const statuses = values
    .map((item) => (typeof item === 'string' ? item.trim() : item))
    .filter((item) => item !== '');

  return statuses.length > 0 ? [...new Set(statuses)] : undefined;
}

export class GetAuthorizedPatientsRequestDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Parte do nome, do nome social, do e-mail, do CNS ou do CPF (com ou sem pontuação), sem diferenciar maiúsculas; vazio equivale a sem busca.',
  })
  @Transform(toOptionalText)
  @IsOptional()
  @IsString(invalidParameter('q'))
  q?: string;

  @ApiPropertyOptional({
    description:
      'Status do PTS do paciente, separados por vírgula; `none` é o paciente sem PTS. O profissional só tem acesso a planning, running, concluded e cancelled.',
    enum: PATIENT_PTS_STATUS_FILTERS,
    isArray: true,
  })
  @Transform(toStatusList)
  @IsOptional()
  @IsIn(PATIENT_PTS_STATUS_FILTERS, invalidEach('status'))
  status?: PatientPtsStatusFilter[];

  @ApiPropertyOptional({
    description: 'Perfil profissional responsável por um PTS do paciente.',
    format: 'uuid',
  })
  @Transform(toOptionalText)
  @IsOptional()
  @IsUUID('all', invalidParameter('responsibleProfessionalId'))
  responsibleProfessionalId?: string;

  @ApiPropertyOptional({
    description: 'Data de cadastro a partir de (AAAA-MM-DD), inclusive.',
    example: '2026-10-01',
  })
  @Transform(toOptionalText)
  @IsOptional()
  @Matches(DATE_ONLY, invalidParameter('registeredFrom'))
  registeredFrom?: string;

  @ApiPropertyOptional({
    description: 'Data de cadastro até (AAAA-MM-DD), inclusive.',
    example: '2026-11-23',
  })
  @Transform(toOptionalText)
  @IsOptional()
  @Matches(DATE_ONLY, invalidParameter('registeredTo'))
  registeredTo?: string;

  @ApiPropertyOptional({ enum: PATIENT_SORT_FIELDS, default: 'name' })
  @Transform(toOptionalText)
  @IsOptional()
  @IsIn(PATIENT_SORT_FIELDS, invalidParameter('sort'))
  sort?: PatientSortField;

  @ApiPropertyOptional({ enum: SORT_ORDERS, default: 'asc' })
  @Transform(toOptionalText)
  @IsOptional()
  @IsIn(SORT_ORDERS, invalidParameter('order'))
  order?: SortOrder;
}
