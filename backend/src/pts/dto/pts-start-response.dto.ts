import { ApiProperty } from '@nestjs/swagger';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';

export class PtsStartResponseDto {
  @ApiProperty({ example: '3f2c9a1e-7b4d-4c8e-9f1a-2b3c4d5e6f70' })
  id!: string;

  @ApiProperty({ enum: [PtsStateEnum.RUNNING], example: PtsStateEnum.RUNNING })
  status!: PtsStateEnum.RUNNING;

  @ApiProperty({ example: '2026-12-01T13:00:00.000Z' })
  beganAt!: string;
}
