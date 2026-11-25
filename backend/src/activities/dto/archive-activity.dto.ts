import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

import { ActivityState } from '../enums/activity.enums';

export class ArchiveActivityRequestDto {
  @ApiPropertyOptional({
    description: 'Motivo opcional, gravado com o arquivamento.',
    example: 'Família assumiu a atividade em casa.',
  })
  @IsOptional()
  @IsString({ message: 'O motivo deve ser um texto.' })
  reason?: string;
}

export class ArchiveActivityResponseDto {
  @ApiProperty({ example: '9c8b7a65-4d3e-4f21-8a9b-0c1d2e3f4a5b' })
  id!: string;

  @ApiProperty({
    enum: [ActivityState.Archived],
    example: ActivityState.Archived,
  })
  status!: ActivityState.Archived;

  @ApiProperty({ example: '2026-12-06T12:00:00.000Z' })
  archivedAt!: string;
}
