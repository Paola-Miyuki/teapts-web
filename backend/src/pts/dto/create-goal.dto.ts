import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

import { GoalArea, GoalTerm } from '../enums/goal.enums';

const DATE_MESSAGE = 'Informe a data-alvo no formato yyyy-mm-dd.';

const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

export class CreateGoalRequestDto {
  @ApiProperty({ example: 'Conversa curta com um colega' })
  @Trim()
  @IsString({ message: 'O título da meta é obrigatório.' })
  @IsNotEmpty({ message: 'O título da meta é obrigatório.' })
  title!: string;

  @ApiProperty({
    description: 'Objetivo SMART.',
    example:
      'Iniciar e manter uma conversa de 3 turnos com um colega em atividades de dupla.',
  })
  @Trim()
  @IsString({ message: 'A descrição da meta é obrigatória.' })
  @IsNotEmpty({ message: 'A descrição da meta é obrigatória.' })
  description!: string;

  @ApiProperty({ enum: GoalTerm, example: GoalTerm.Short })
  @IsEnum(GoalTerm, { message: 'Informe o prazo: short, medium ou long.' })
  term!: GoalTerm;

  @ApiProperty({ enum: GoalArea, example: GoalArea.Social })
  @IsEnum(GoalArea, {
    message:
      'Informe a área: communication, social, cognitive ou motor_sensory.',
  })
  area!: GoalArea;

  @ApiProperty({ example: '3 conversas por semana registradas pela escola' })
  @Trim()
  @IsString({ message: 'O critério de medida é obrigatório.' })
  @IsNotEmpty({ message: 'O critério de medida é obrigatório.' })
  measureCriterion!: string;

  @ApiProperty({
    description: 'Até a próxima revisão do PTS (RN031).',
    example: '2027-02-28',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: DATE_MESSAGE })
  @IsISO8601({ strict: true }, { message: DATE_MESSAGE })
  targetDate!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Profissional da equipe a quem o admin atribui a autoria (RN029). Ignorado para o profissional, que é sempre o autor.',
  })
  @IsOptional()
  @IsUUID(undefined, {
    message: 'authorProfessionalId deve ser um UUID válido.',
  })
  authorProfessionalId?: string;
}
