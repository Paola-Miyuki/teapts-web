// Este arquivo define e valida o corpo do cadastro de perfil profissional.
// Os erros saem `{ status: 'VALIDATION_ERROR', message }` pelo pipe global.

import { IsEnum, IsUUID } from 'class-validator';
import { Specialism } from '../enums/specialism.enum';

/** Corpo do `POST /professionals`. */
export class CreateProfessionalRequestDto {
  /**
   * Conta de usuário comum que recebe o perfil profissional.
   * @example 0b6f5a4e-2c1d-4e8f-9a7b-3c2d1e0f9a8b
   */
  @IsUUID('all', { message: 'Informe uma conta válida.' })
  accountId: string;

  /** @example psychologist */
  @IsEnum(Specialism, { message: 'Informe uma especialidade válida.' })
  specialism: Specialism;
}
