import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

import { ActivityState } from '../enums/activity.enums';

const CHANGED_STATES = [
  ActivityState.Suspended,
  ActivityState.Running,
  ActivityState.Concluded,
] as const;

export class SuspendActivityRequestDto {
  @ApiPropertyOptional({
    description: 'Motivo opcional, gravado com a suspensão.',
    example: 'Reforma da sala.',
  })
  @IsOptional()
  @IsString({ message: 'O motivo deve ser um texto.' })
  reason?: string;
}

export class ActivityStatusResponseDto {
  @ApiProperty({ example: '9c8b7a65-4d3e-4f21-8a9b-0c1d2e3f4a5b' })
  id!: string;

  @ApiProperty({ enum: CHANGED_STATES, example: ActivityState.Suspended })
  status!: (typeof CHANGED_STATES)[number];

  @ApiProperty({ example: '2026-12-07T12:00:00.000Z' })
  changedAt!: string;
}
