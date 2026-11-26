// Este arquivo define e valida o corpo da troca de especialidade do perfil
// profissional. Os erros saem `{ status: 'VALIDATION_ERROR', message }` pelo
// pipe global.

import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { Specialism } from '../enums/specialism.enum';
import { UFS, type Uf } from '../enums/uf.enum';

/** Corpo do `PATCH /professionals/:id`. */
export class UpdateProfessionalRequestDto {
  /** @example occupational_therapist */
  @IsEnum(Specialism, { message: 'Informe uma especialidade válida.' })
  specialism: Specialism;

  /**
   * Número do novo registro; só quando o conselho da especialidade muda.
   * @example 6789
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'Informe o número do registro.' })
  @IsNotEmpty({ message: 'Informe o número do registro.' })
  @Matches(/\S/, { message: 'Informe o número do registro.' })
  councilNumber?: string;

  /** UF do novo registro, em minúsculas; só quando o conselho muda. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(UFS, { message: 'Informe uma UF válida.' })
  councilState?: Uf;
}
