import { ApiProperty } from '@nestjs/swagger';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import { PtsProposalProfessionalResponseDto } from './pts-proposal-response.dto';

/** PTS com o responsável e a equipe, devolvido pelas rotas de equipe (RFEM). */
export class PtsTeamResponseDto {
  @ApiProperty({ example: '3f2e1d0c-9b8a-4765-a432-10fedcba9876' })
  id!: string;

  @ApiProperty({ enum: PtsStateEnum, example: PtsStateEnum.RUNNING })
  status!: PtsStateEnum;

  @ApiProperty({ type: PtsProposalProfessionalResponseDto })
  responsible!: PtsProposalProfessionalResponseDto;

  @ApiProperty({ type: PtsProposalProfessionalResponseDto, isArray: true })
  team!: PtsProposalProfessionalResponseDto[];
}
