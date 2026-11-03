import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import {
  PtsProposalPatientResponseDto,
  PtsProposalProfessionalResponseDto,
} from './pts-proposal-response.dto';

export class ActivePtsResponseDto {
  @ApiProperty({ example: 'uuid-do-pts' })
  id!: string;

  @ApiProperty({
    enum: [PtsStateEnum.PLANNING, PtsStateEnum.RUNNING],
    example: PtsStateEnum.PLANNING,
  })
  status!: PtsStateEnum.PLANNING | PtsStateEnum.RUNNING;

  @ApiPropertyOptional({
    example: 'Mora com a mãe e frequenta a escola municipal.',
  })
  socialSituation?: string;

  @ApiProperty({ example: '2026-10-15T12:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ nullable: true, example: null })
  acceptedAt!: string | null;

  @ApiProperty({ nullable: true, example: null })
  beganAt!: string | null;

  @ApiProperty({ type: PtsProposalPatientResponseDto })
  patient!: PtsProposalPatientResponseDto;

  @ApiProperty({ type: PtsProposalProfessionalResponseDto })
  responsible!: PtsProposalProfessionalResponseDto;

  @ApiProperty({
    type: PtsProposalProfessionalResponseDto,
    isArray: true,
  })
  team!: PtsProposalProfessionalResponseDto[];
}
