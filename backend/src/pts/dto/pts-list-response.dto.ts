import { ApiProperty } from '@nestjs/swagger';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import { PaginationResponseDto } from '../../common/pagination/pagination-response.dto';
import {
  PtsProposalPatientResponseDto,
  PtsProposalProfessionalResponseDto,
} from './pts-proposal-response.dto';

export class PtsListItemResponseDto {
  @ApiProperty({ example: 'uuid-do-pts' })
  id!: string;

  @ApiProperty({ enum: PtsStateEnum, example: PtsStateEnum.RUNNING })
  status!: PtsStateEnum;

  @ApiProperty({
    example: 2,
    description: 'Ordem do PTS entre os do paciente, pela data de criação.',
  })
  version!: number;

  @ApiProperty({ example: '2026-10-26T14:30:00.000Z' })
  createdAt!: string;

  @ApiProperty({ nullable: true, example: '2026-11-01T12:00:00.000Z' })
  beganAt!: string | null;

  @ApiProperty({
    nullable: true,
    example: '2026-12-30T12:00:00.000Z',
    description: 'Conclusão ou cancelamento.',
  })
  closedAt!: string | null;

  /** Nome social, se houver; senão o nome. */
  @ApiProperty({ type: PtsProposalPatientResponseDto })
  patient!: PtsProposalPatientResponseDto;

  @ApiProperty({ type: PtsProposalProfessionalResponseDto })
  responsible!: PtsProposalProfessionalResponseDto;

  @ApiProperty({ type: PtsProposalProfessionalResponseDto, isArray: true })
  team!: PtsProposalProfessionalResponseDto[];
}

export class GetPtsListResponseDto {
  @ApiProperty({ type: PtsListItemResponseDto, isArray: true })
  data!: PtsListItemResponseDto[];

  @ApiProperty({ type: PaginationResponseDto })
  pagination!: PaginationResponseDto;
}
