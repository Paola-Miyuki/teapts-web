import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

import { ActivityState } from '../enums/activity.enums';

const DECIDED_STATES = [ActivityState.Running, ActivityState.Rejected] as const;

export class RejectActivityRequestDto {
  @ApiPropertyOptional({
    description: 'Motivo opcional, gravado com a rejeição.',
    example: 'Já existe atividade equivalente.',
  })
  @IsOptional()
  @IsString({ message: 'O motivo deve ser um texto.' })
  reason?: string;
}

export class ActivityDecisionResponseDto {
  @ApiProperty({ example: '9c8b7a65-4d3e-4f21-8a9b-0c1d2e3f4a5b' })
  id!: string;

  @ApiProperty({ enum: DECIDED_STATES, example: ActivityState.Rejected })
  status!: (typeof DECIDED_STATES)[number];

  @ApiProperty({ example: '2026-12-02T12:00:00.000Z' })
  decidedAt!: string;
}
