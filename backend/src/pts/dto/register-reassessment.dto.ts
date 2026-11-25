import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';

import { GoalStatus } from '../enums/goal.enums';

const DATE_MESSAGE = 'Informe a data do encontro no formato yyyy-mm-dd.';
const GOALS_MESSAGE = 'Informe o resultado das metas.';

/** Resultados possíveis da meta na reavaliação (RFEVA005). */
export const GOAL_RESULTS = [
  GoalStatus.Achieved,
  GoalStatus.PartiallyAchieved,
  GoalStatus.NotAchieved,
] as const;
export type GoalResult = (typeof GOAL_RESULTS)[number];

export class GoalResultDto {
  @ApiProperty({ example: '5d7a1b3c-9e2f-4a6b-8c0d-1e2f3a4b5c6d' })
  @IsUUID(undefined, { message: 'goalId deve ser um UUID válido.' })
  goalId!: string;

  @ApiProperty({ enum: GOAL_RESULTS, example: GoalStatus.PartiallyAchieved })
  @IsIn(GOAL_RESULTS, {
    message:
      'Informe o resultado: achieved, partially_achieved ou not_achieved.',
  })
  status!: GoalResult;

  @ApiPropertyOptional({ example: 'Conversa 2 vezes por semana.' })
  @IsOptional()
  @IsString({ message: 'A observação deve ser um texto.' })
  note?: string;
}

export class RegisterReassessmentRequestDto {
  @ApiProperty({ example: '2026-12-15', description: 'Data do encontro.' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: DATE_MESSAGE })
  @IsISO8601({ strict: true }, { message: DATE_MESSAGE })
  meetingDate!: string;

  @ApiProperty({ type: GoalResultDto, isArray: true })
  @IsArray({ message: GOALS_MESSAGE })
  @ValidateNested({ each: true })
  @Type(() => GoalResultDto)
  goals!: GoalResultDto[];

  @ApiProperty({
    example: true,
    description: 'true cria o rascunho da próxima versão (RFPTS013).',
  })
  @IsBoolean({ message: 'Informe se cria o próximo PTS.' })
  createNextVersion!: boolean;

  @ApiPropertyOptional({ example: 'Metas do ciclo revistas pela equipe.' })
  @IsOptional()
  @IsString({ message: 'O motivo deve ser um texto.' })
  reason?: string;
}

export class RegisterReassessmentResponseDto {
  @ApiProperty({ example: '3f2c9a1e-7b4d-4c8e-9f1a-2b3c4d5e6f70' })
  id!: string;

  @ApiProperty({ enum: ['concluded'], example: 'concluded' })
  status!: 'concluded';

  @ApiProperty({ example: '2026-12-15', description: 'Data do encontro.' })
  reassessedAt!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '8a9b0c1d-2e3f-4a5b-8c6d-7e8f9a0b1c2d',
  })
  nextPtsId!: string | null;
}
