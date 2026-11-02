import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateSocialSituationRequestDto {
  @ApiProperty({
    example: 'Mora com a mãe e a avó; iniciou acompanhamento no CAPS.',
  })
  @IsString()
  @IsNotEmpty()
  socialSituation!: string;
}

export class UpdateSocialSituationResponseDto {
  @ApiProperty({ example: 'uuid-do-pts' })
  id!: string;

  @ApiProperty({
    example: 'Mora com a mãe e a avó; iniciou acompanhamento no CAPS.',
  })
  socialSituation!: string;
}
