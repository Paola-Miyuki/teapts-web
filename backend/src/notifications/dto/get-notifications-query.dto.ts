import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

import {
  PaginationQueryDto,
  invalidParameter,
} from '../../common/pagination/pagination-query.dto';

function toBoolean({ value }: { value: unknown }): unknown {
  if (value === '') {
    return undefined;
  }

  return value === 'true' ? true : value === 'false' ? false : value;
}

export class GetNotificationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    type: Boolean,
    description: 'Com `true`, só as não lidas.',
  })
  @Transform(toBoolean)
  @IsOptional()
  @IsBoolean(invalidParameter('unread'))
  unread?: boolean;
}
