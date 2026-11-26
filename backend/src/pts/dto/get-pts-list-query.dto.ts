// Este arquivo define e valida os parâmetros da listagem de PTS (`GET /pts`).

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
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

export const PTS_LIST_SORT_FIELDS = ['createdAt', 'status'] as const;
export type PtsListSortField = (typeof PTS_LIST_SORT_FIELDS)[number];

export const PTS_LIST_ORDERS = ['asc', 'desc'] as const;
export type PtsListOrder = (typeof PTS_LIST_ORDERS)[number];

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function invalidEach(parameter: string): ValidationOptions {
  return { ...invalidParameter(parameter), each: true };
}

/** Texto opcional: espaços externos saem, e vazio equivale a sem filtro. */
function toOptionalText({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() || undefined : value;
}

/** Aceita `status=a,b` ou `status=a&status=b`; vazio equivale a sem filtro. */
function toStatusList({ value }: { value: unknown }): unknown {
  if (value === undefined) {
    return undefined;
  }

  const statuses = (Array.isArray(value) ? value : [value])
    .flatMap((item) => (typeof item === 'string' ? item.split(',') : [item]))
    .map((item) => (typeof item === 'string' ? item.trim() : item))
    .filter((item) => item !== '');

  return statuses.length > 0 ? [...new Set(statuses)] : undefined;
}

export class GetPtsListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Parte do nome, do nome social ou do CNS do paciente, sem diferenciar maiúsculas; vazio equivale a sem busca.',
  })
  @Transform(toOptionalText)
  @IsOptional()
  @IsString(invalidParameter('q'))
  q?: string;

  @ApiPropertyOptional({
    description: 'Status do PTS, separados por vírgula.',
    enum: PtsStateEnum,
    isArray: true,
  })
  @Transform(toStatusList)
  @IsOptional()
  @IsIn(Object.values(PtsStateEnum), invalidEach('status'))
  status?: PtsStateEnum[];

  @ApiPropertyOptional({
    description: 'Perfil profissional responsável pelo PTS.',
    format: 'uuid',
  })
  @Transform(toOptionalText)
  @IsOptional()
  @IsUUID('all', invalidParameter('responsibleId'))
  responsibleId?: string;

  @ApiPropertyOptional({
    description:
      'Perfil profissional da equipe do PTS (o responsável também conta, RN005).',
    format: 'uuid',
  })
  @Transform(toOptionalText)
  @IsOptional()
  @IsUUID('all', invalidParameter('memberId'))
  memberId?: string;

  @ApiPropertyOptional({
    description: 'Data de criação a partir de (AAAA-MM-DD), inclusive.',
    example: '2026-10-01',
  })
  @Transform(toOptionalText)
  @IsOptional()
  @Matches(DATE_ONLY, invalidParameter('createdFrom'))
  @IsISO8601({ strict: true }, invalidParameter('createdFrom'))
  createdFrom?: string;

  @ApiPropertyOptional({
    description: 'Data de criação até (AAAA-MM-DD), inclusive.',
    example: '2026-11-23',
  })
  @Transform(toOptionalText)
  @IsOptional()
  @Matches(DATE_ONLY, invalidParameter('createdTo'))
  @IsISO8601({ strict: true }, invalidParameter('createdTo'))
  createdTo?: string;

  @ApiPropertyOptional({
    enum: PTS_LIST_SORT_FIELDS,
    default: 'createdAt',
    description:
      '`status` segue a ordem do ciclo: proposta, planejamento, andamento, concluído, cancelado, rejeitado.',
  })
  @Transform(toOptionalText)
  @IsOptional()
  @IsIn(PTS_LIST_SORT_FIELDS, invalidParameter('sort'))
  sort?: PtsListSortField;

  @ApiPropertyOptional({ enum: PTS_LIST_ORDERS, default: 'desc' })
  @Transform(toOptionalText)
  @IsOptional()
  @IsIn(PTS_LIST_ORDERS, invalidParameter('order'))
  order?: PtsListOrder;
}
