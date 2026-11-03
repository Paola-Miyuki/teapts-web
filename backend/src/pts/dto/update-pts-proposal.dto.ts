import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class UpdatePtsProposalRequestDto {
  @ApiPropertyOptional({
    example: 'Mora com a mãe e frequenta a escola municipal.',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  socialSituation?: string;

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    example: ['5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a'],
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @IsUUID('4', { each: true })
  teamProfessionalIds?: string[];
}
