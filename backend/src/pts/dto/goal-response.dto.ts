import { ApiProperty } from '@nestjs/swagger';

import {
  GoalArea,
  GoalOrigin,
  GoalStatus,
  GoalTerm,
} from '../enums/goal.enums';

export class GoalRegisteredByDto {
  @ApiProperty({ example: 'uuid-do-profissional' })
  id!: string;

  @ApiProperty({ example: 'João Lima' })
  name!: string;
}

export class GoalResponseDto {
  @ApiProperty({ example: '5d7a1b3c-9e2f-4a6b-8c0d-1e2f3a4b5c6d' })
  id!: string;

  @ApiProperty({ example: 'Conversa curta com um colega' })
  title!: string;

  @ApiProperty({
    example:
      'Iniciar e manter uma conversa de 3 turnos com um colega em atividades de dupla.',
  })
  description!: string;

  @ApiProperty({ enum: GoalTerm, nullable: true, example: GoalTerm.Short })
  term!: GoalTerm | null;

  @ApiProperty({ enum: GoalArea, example: GoalArea.Social })
  area!: GoalArea;

  @ApiProperty({ example: '3 conversas por semana registradas pela escola' })
  measureCriterion!: string;

  @ApiProperty({ type: String, nullable: true, example: '2027-02-28' })
  targetDate!: string | null;

  @ApiProperty({ enum: GoalStatus, example: GoalStatus.InProgress })
  status!: GoalStatus;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description: 'Observação do resultado, dada na reavaliação (RFEVA005).',
  })
  resultNote!: string | null;

  @ApiProperty({ enum: GoalOrigin, example: GoalOrigin.New })
  origin!: GoalOrigin;

  @ApiProperty({ description: 'Atividades ligadas à meta.', example: 0 })
  activitiesCount!: number;

  @ApiProperty({
    type: GoalRegisteredByDto,
    description:
      'Profissional autor ou, sem ele, a conta que registrou (RN029).',
  })
  registeredBy!: GoalRegisteredByDto;

  @ApiProperty({ example: '2026-11-25T12:00:00.000Z' })
  createdAt!: string;
}

export class GetGoalsResponseDto {
  @ApiProperty({ type: GoalResponseDto, isArray: true })
  data!: GoalResponseDto[];
}

export class DeleteGoalResponseDto {
  @ApiProperty({ example: 'OK' })
  status!: 'OK';
}
