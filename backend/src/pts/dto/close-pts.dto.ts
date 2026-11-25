import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

const DATE_MESSAGE = 'Informe a data de encerramento no formato yyyy-mm-dd.';

export const CLOSE_OUTCOMES = ['concluded', 'cancelled'] as const;
export type CloseOutcome = (typeof CLOSE_OUTCOMES)[number];

export class ClosePtsRequestDto {
  @ApiProperty({ enum: CLOSE_OUTCOMES, example: 'cancelled' })
  @IsIn(CLOSE_OUTCOMES, {
    message: 'Informe como encerrar: concluded ou cancelled.',
  })
  outcome!: CloseOutcome;

  @ApiProperty({ example: '2026-12-10' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: DATE_MESSAGE })
  @IsISO8601({ strict: true }, { message: DATE_MESSAGE })
  closingDate!: string;

  @ApiPropertyOptional({
    description: 'Motivo opcional, também no cancelamento.',
    example: 'A família mudou de cidade.',
  })
  @IsOptional()
  @IsString({ message: 'O motivo deve ser um texto.' })
  reason?: string;
}

export class ClosePtsResponseDto {
  @ApiProperty({ example: '3f2c9a1e-7b4d-4c8e-9f1a-2b3c4d5e6f70' })
  id!: string;

  @ApiProperty({ enum: CLOSE_OUTCOMES, example: 'cancelled' })
  status!: CloseOutcome;

  @ApiProperty({ example: '2026-12-10' })
  closingDate!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'A família mudou de cidade.',
  })
  closingReason!: string | null;
}
