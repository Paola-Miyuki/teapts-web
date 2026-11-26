import { ApiProperty } from '@nestjs/swagger';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';

export class PtsDecisionResponseDto {
  @ApiProperty({ example: 'uuid-do-pts' })
  id!: string;

  @ApiProperty({
    enum: [PtsStateEnum.PLANNING, PtsStateEnum.REJECTED],
    example: PtsStateEnum.PLANNING,
  })
  status!: PtsStateEnum.PLANNING | PtsStateEnum.REJECTED;

  @ApiProperty({ nullable: true, example: '2026-10-15T12:30:00.000Z' })
  acceptedAt!: string | null;

  @ApiProperty({ nullable: true, example: null })
  rejectedAt!: string | null;
}
