import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsOptional,
  type ValidationOptions,
} from 'class-validator';

import {
  invalidParameter,
  PaginationQueryDto,
} from '../../common/pagination/pagination-query.dto';
import { ActivityExecutor, ActivityState } from '../enums/activity.enums';

export const ACTIVITY_STATUS_FILTERS = Object.values(ActivityState);

function invalidEach(parameter: string): ValidationOptions {
  return { ...invalidParameter(parameter), each: true };
}

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

export class GetActivitiesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ACTIVITY_STATUS_FILTERS,
    isArray: true,
    description:
      'Um ou mais status, separados por vírgula ou repetindo o parâmetro.',
    example: ['running'],
  })
  @Transform(toList)
  @IsOptional()
  @IsIn(ACTIVITY_STATUS_FILTERS, invalidEach('status'))
  status?: ActivityState[];

  @ApiPropertyOptional({ enum: ActivityExecutor })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsEnum(ActivityExecutor, invalidParameter('executor'))
  executor?: ActivityExecutor;
}
