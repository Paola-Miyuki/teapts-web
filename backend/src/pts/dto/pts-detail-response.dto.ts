import { ApiProperty } from '@nestjs/swagger';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import {
  PtsProposalPatientResponseDto,
  PtsProposalProfessionalResponseDto,
} from './pts-proposal-response.dto';
import { PtsSheetViewDto } from './update-pts-sheet.dto';

export class PreviousPtsDto {
  @ApiProperty({ example: 'uuid-do-pts-anterior' })
  id!: string;

  @ApiProperty({ example: 1 })
  version!: number;
}

/** PTS em qualquer estado, com as datas de cada mudança (RFPTS001, RFPTS009). */
export class PtsDetailResponseDto extends PtsSheetViewDto {
  @ApiProperty({ example: 'uuid-do-pts' })
  id!: string;

  @ApiProperty({ enum: PtsStateEnum, example: PtsStateEnum.CONCLUDED })
  status!: PtsStateEnum;

  @ApiProperty({ example: '2026-10-15T12:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ nullable: true, example: '2026-10-16T12:00:00.000Z' })
  acceptedAt!: string | null;

  @ApiProperty({ nullable: true, example: null })
  rejectedAt!: string | null;

  @ApiProperty({ nullable: true, example: '2026-10-20T12:00:00.000Z' })
  beganAt!: string | null;

  @ApiProperty({ nullable: true, example: '2027-04-15T12:00:00.000Z' })
  concludedAt!: string | null;

  @ApiProperty({ nullable: true, example: null })
  cancelledAt!: string | null;

  @ApiProperty({ example: 2 })
  version!: number;

  @ApiProperty({ type: PreviousPtsDto, nullable: true })
  previousPts!: PreviousPtsDto | null;

  @ApiProperty({ type: String, nullable: true, example: '2027-04-15' })
  closingDate!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Metas do ciclo atingidas.',
  })
  closingReason!: string | null;

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
