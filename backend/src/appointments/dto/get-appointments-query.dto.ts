import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsUUID,
  Matches,
  type ValidationOptions,
} from 'class-validator';

import { ActivityModality } from '../../activities/enums/activity.enums';
import {
  invalidParameter,
  PaginationQueryDto,
} from '../../common/pagination/pagination-query.dto';
import { Specialism } from '../../professionals/enums/specialism.enum';
import { Attendance } from '../enums/attendance.enum';

const ATTENDANCES = Object.values(Attendance);
const MODALITIES = Object.values(ActivityModality);
const SPECIALISMS = Object.values(Specialism);
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function invalidEach(parameter: string): ValidationOptions {
  return { ...invalidParameter(parameter), each: true };
}

function toOptionalText({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() || undefined : value;
}

/** Aceita `a,b` ou o parâmetro repetido; vazio equivale a sem filtro. */
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

/** Query do `GET /appointments` (RFACT006). */
export class GetAppointmentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Atendimentos de um paciente (o id da conta do paciente).',
  })
  @Transform(toOptionalText)
  @IsOptional()
  @IsUUID('all', invalidParameter('patientId'))
  patientId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Atendimentos das atividades de um PTS.',
  })
  @Transform(toOptionalText)
  @IsOptional()
  @IsUUID('all', invalidParameter('ptsId'))
  ptsId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Atendimentos de uma atividade.',
  })
  @Transform(toOptionalText)
  @IsOptional()
  @IsUUID('all', invalidParameter('activityId'))
  activityId?: string;

  @ApiPropertyOptional({
    enum: ATTENDANCES,
    isArray: true,
    description:
      'Comparecimento, um ou mais, separados por vírgula ou repetindo o parâmetro.',
    example: ['done'],
  })
  @Transform(toList)
  @IsOptional()
  @IsIn(ATTENDANCES, invalidEach('attendance'))
  attendance?: Attendance[];

  @ApiPropertyOptional({
    enum: SPECIALISMS,
    isArray: true,
    description: 'Especialidade da atividade, uma ou mais.',
    example: ['occupational_therapist'],
  })
  @Transform(toList)
  @IsOptional()
  @IsIn(SPECIALISMS, invalidEach('specialism'))
  specialism?: Specialism[];

  @ApiPropertyOptional({
    enum: MODALITIES,
    isArray: true,
    description: 'Modalidade do atendimento, uma ou mais.',
    example: ['in_person'],
  })
  @Transform(toList)
  @IsOptional()
  @IsIn(MODALITIES, invalidEach('modality'))
  modality?: ActivityModality[];

  @ApiPropertyOptional({
    description: 'Atendimentos a partir desta data (AAAA-MM-DD), inclusive.',
    example: '2026-11-01',
  })
  @Transform(toOptionalText)
  @IsOptional()
  @Matches(DATE_ONLY, invalidParameter('from'))
  @IsISO8601({ strict: true }, invalidParameter('from'))
  from?: string;

  @ApiPropertyOptional({
    description: 'Atendimentos até esta data (AAAA-MM-DD), inclusive.',
    example: '2026-11-30',
  })
  @Transform(toOptionalText)
  @IsOptional()
  @Matches(DATE_ONLY, invalidParameter('to'))
  @IsISO8601({ strict: true }, invalidParameter('to'))
  to?: string;
}
