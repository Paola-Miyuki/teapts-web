import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsArray, IsUUID, ValidateIf } from 'class-validator';

import { UpdatePtsSheetRequestDto } from './update-pts-sheet.dto';

/** Ficha, data máxima e equipe da proposta: só o que for enviado muda (RFPTS007). */
export class UpdatePtsProposalRequestDto extends PartialType(
  UpdatePtsSheetRequestDto,
  // Só o campo ausente é opcional: null continua inválido nos obrigatórios.
  { skipNullProperties: false },
) {
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
