import { ApiProperty } from '@nestjs/swagger';

export class DeletePtsProposalResponseDto {
  @ApiProperty({ enum: ['OK'], example: 'OK' })
  status!: 'OK';
}
