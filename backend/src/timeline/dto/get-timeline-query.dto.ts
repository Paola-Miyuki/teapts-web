// Este arquivo define e valida os parâmetros de GET /pts/:id/timeline.
// Segue o padrão das listagens: estende o PaginationQueryDto e os erros saem
// `{ status: 'ERROR', message: 'Parâmetro inválido: <param>' }`.

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
import { TimelineRecordTarget } from '../enums/timeline-record-target.enum';

export const TIMELINE_TYPE_FILTERS = Object.values(TimelineRecordTarget);

export const TIMELINE_ORDERS = ['asc', 'desc'] as const;
export type TimelineOrder = (typeof TIMELINE_ORDERS)[number];

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function invalidEach(parameter: string): ValidationOptions {
  return { ...invalidParameter(parameter), each: true };
}

/** Texto opcional: espaços externos saem, e vazio equivale a sem filtro. */
function toOptionalText({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() || undefined : value;
}

/** Aceita `type=a,b` ou `type=a&type=b`; vazio equivale a sem filtro. */
function toTypeList({ value }: { value: unknown }): unknown {
  if (value === undefined) {
    return undefined;
  }

  const types = (Array.isArray(value) ? value : [value])
    .flatMap((item) => (typeof item === 'string' ? item.split(',') : [item]))
    .map((item) => (typeof item === 'string' ? item.trim() : item))
    .filter((item) => item !== '');

  return types.length > 0 ? [...new Set(types)] : undefined;
}

export class GetTimelineQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Parte da descrição do evento ou do nome do autor, sem diferenciar maiúsculas; `%` e `_` contam como texto.',
    example: 'integração',
  })
  @Transform(toOptionalText)
  @IsOptional()
  @IsString(invalidParameter('q'))
  q?: string;

  @ApiPropertyOptional({
    description:
      'Tipo do evento (o alvo). Aceita um ou mais, separados por vírgula ou repetindo o parâmetro. Eventos de meta e da ficha entram como `pts`.',
    enum: TIMELINE_TYPE_FILTERS,
    isArray: true,
    example: ['activity'],
  })
  @Transform(toTypeList)
  @IsOptional()
  @IsIn(TIMELINE_TYPE_FILTERS, invalidEach('type'))
  type?: TimelineRecordTarget[];

  @ApiPropertyOptional({
    description:
      'Autor do evento (quem executou): o id da conta (`author.id`) ou o id do perfil profissional dessa conta.',
    format: 'uuid',
  })
  @Transform(toOptionalText)
  @IsOptional()
  @IsUUID('all', invalidParameter('authorId'))
  authorId?: string;

  @ApiPropertyOptional({
    description: 'Eventos a partir desta data (AAAA-MM-DD), inclusive.',
    example: '2026-11-01',
  })
  @Transform(toOptionalText)
  @IsOptional()
  @Matches(DATE_ONLY, invalidParameter('from'))
  @IsISO8601({ strict: true }, invalidParameter('from'))
  from?: string;

  @ApiPropertyOptional({
    description: 'Eventos até esta data (AAAA-MM-DD), inclusive.',
    example: '2026-11-30',
  })
  @Transform(toOptionalText)
  @IsOptional()
  @Matches(DATE_ONLY, invalidParameter('to'))
  @IsISO8601({ strict: true }, invalidParameter('to'))
  to?: string;

  @ApiPropertyOptional({
    enum: TIMELINE_ORDERS,
    default: 'desc',
    description:
      'Ordem pela data do evento: `desc`, do mais recente ao mais antigo (padrão), ou `asc`.',
  })
  @Transform(toOptionalText)
  @IsOptional()
  @IsIn(TIMELINE_ORDERS, invalidParameter('order'))
  order?: TimelineOrder;
}
