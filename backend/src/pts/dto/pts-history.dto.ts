import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, Max, Min, type ValidationOptions } from 'class-validator';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';

export const DEFAULT_PTS_HISTORY_PAGE = 1;
export const DEFAULT_PTS_HISTORY_LIMIT = 20;
export const MAX_PTS_HISTORY_LIMIT = 50;

function invalidParameter(parameter: 'page' | 'limit'): ValidationOptions {
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

export class PtsHistoryQueryDto {
  @ApiPropertyOptional({
    type: 'integer',
    default: DEFAULT_PTS_HISTORY_PAGE,
    minimum: 1,
  })
  @Transform(toNumber(DEFAULT_PTS_HISTORY_PAGE))
  @IsInt(invalidParameter('page'))
  @Min(1, invalidParameter('page'))
  page = DEFAULT_PTS_HISTORY_PAGE;

  @ApiPropertyOptional({
    type: 'integer',
    default: DEFAULT_PTS_HISTORY_LIMIT,
    minimum: 1,
    maximum: MAX_PTS_HISTORY_LIMIT,
  })
  @Transform(toNumber(DEFAULT_PTS_HISTORY_LIMIT))
  @IsInt(invalidParameter('limit'))
  @Min(1, invalidParameter('limit'))
  @Max(MAX_PTS_HISTORY_LIMIT, invalidParameter('limit'))
  limit = DEFAULT_PTS_HISTORY_LIMIT;
}

export class PtsHistoryProfessionalDto {
  @ApiProperty({ example: 'uuid-do-profissional' })
  id!: string;

  @ApiProperty({ example: 'Ana Souza' })
  name!: string;

  @ApiProperty({ example: 'Psicologia' })
  specialism!: string;
}

export class PtsHistoryTeamMemberDto {
  @ApiProperty({ example: 'uuid-do-profissional' })
  id!: string;

  @ApiProperty({ example: 'João Lima' })
  name!: string;
}

export class PtsHistoryGoalsResultDto {
  @ApiProperty({ example: 2 })
  achieved!: number;

  @ApiProperty({ example: 1 })
  partiallyAchieved!: number;

  @ApiProperty({ example: 0 })
  notAchieved!: number;
}

export class PtsHistoryItemDto {
  @ApiProperty({ example: 'uuid-do-pts' })
  id!: string;

  @ApiProperty({ example: 1 })
  version!: number;

  @ApiProperty({ enum: PtsStateEnum })
  status!: PtsStateEnum;

  @ApiProperty({ type: PtsHistoryProfessionalDto })
  responsible!: PtsHistoryProfessionalDto;

  @ApiProperty({ type: PtsHistoryTeamMemberDto, isArray: true })
  team!: PtsHistoryTeamMemberDto[];

  @ApiProperty({ example: '2025-03-01T12:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ nullable: true, example: '2025-03-05T12:00:00.000Z' })
  acceptedAt!: string | null;

  @ApiProperty({ nullable: true, example: '2025-03-10T12:00:00.000Z' })
  beganAt!: string | null;

  @ApiProperty({ nullable: true, example: '2025-12-30T12:00:00.000Z' })
  closedAt!: string | null;

  @ApiProperty({ type: PtsHistoryGoalsResultDto, nullable: true })
  goalsResult!: PtsHistoryGoalsResultDto | null;
}

export class PtsHistoryPaginationDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 1 })
  total!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class GetPtsHistoryResponseDto {
  @ApiProperty({ type: PtsHistoryItemDto, isArray: true })
  data!: PtsHistoryItemDto[];

  @ApiProperty({ type: PtsHistoryPaginationDto })
  pagination!: PtsHistoryPaginationDto;
}
