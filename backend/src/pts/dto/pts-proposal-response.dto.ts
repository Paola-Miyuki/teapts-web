import { ApiProperty } from '@nestjs/swagger';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';

export class PtsProposalSpecialismResponseDto {
  @ApiProperty({ example: 'psychologist' })
  id!: string;

  @ApiProperty({ example: 'Psicologia' })
  name!: string;
}

export class PtsProposalProfessionalResponseDto {
  @ApiProperty({ example: 'uuid-do-profissional' })
  id!: string;

  @ApiProperty({ example: 'Maria Silva' })
  name!: string;

  @ApiProperty({ type: PtsProposalSpecialismResponseDto })
  specialism!: PtsProposalSpecialismResponseDto;
}

export class PtsProposalPatientResponseDto {
  @ApiProperty({ example: 'uuid-da-conta-do-paciente' })
  id!: string;

  @ApiProperty({ example: 'João Silva' })
  name!: string;
}

export class PtsProposalResponseDto {
  @ApiProperty({ example: 'uuid-da-proposta' })
  id!: string;

  @ApiProperty({ enum: PtsStateEnum, example: PtsStateEnum.DRAFT })
  status!: PtsStateEnum;

  @ApiProperty({
    example: 'Paciente necessita de acompanhamento multidisciplinar.',
  })
  socialSituation!: string;

  @ApiProperty({ example: '2026-10-26T14:30:00.000Z' })
  createdAt!: string;

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

export class PtsProposalsPaginationResponseDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 45 })
  total!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}

export class GetPtsProposalsResponseDto {
  @ApiProperty({ type: PtsProposalResponseDto, isArray: true })
  data!: PtsProposalResponseDto[];

  @ApiProperty({ type: PtsProposalsPaginationResponseDto })
  pagination!: PtsProposalsPaginationResponseDto;
}
