// Este arquivo define e valida o corpo do cadastro de perfil profissional.
// Os erros saem `{ status: 'VALIDATION_ERROR', message }` pelo pipe global.

import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  IsEnum,
} from 'class-validator';
import { Specialism } from '../enums/specialism.enum';
import { UFS, type Uf } from '../enums/uf.enum';

/** Corpo do `POST /professionals`. */
export class CreateProfessionalRequestDto {
  /**
   * Conta de usuário comum que recebe o perfil profissional.
   * @example 0b6f5a4e-2c1d-4e8f-9a7b-3c2d1e0f9a8b
   */
  @IsUUID('all', { message: 'Informe uma conta válida.' })
  accountId: string;

  /** @example speech_therapist */
  @IsEnum(Specialism, { message: 'Informe uma especialidade válida.' })
  specialism: Specialism;

  /**
   * Número do registro no conselho; o conselho vem da especialidade (RN026).
   * @example 6789
   */
  @IsString({ message: 'Informe o número do registro.' })
  @IsNotEmpty({ message: 'Informe o número do registro.' })
  @Matches(/\S/, { message: 'Informe o número do registro.' })
  councilNumber: string;

  /** UF do registro, em minúsculas. */
  @IsIn(UFS, { message: 'Informe uma UF válida.' })
  councilState: Uf;

  /**
   * Instituição ou serviço de vínculo.
   * @example CAPSi Boa Vista
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'Informe uma instituição válida.' })
  institution?: string;

  /**
   * CNES, 7 dígitos.
   * @example 1234567
   */
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{7}$/, { message: 'O CNES deve ter 7 dígitos.' })
  cnes?: string;
}
