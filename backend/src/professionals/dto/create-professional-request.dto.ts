// Este arquivo define o corpo do cadastro de perfil profissional.

import { Specialism } from '../enums/specialism.enum';

/** Corpo do `POST /professionals`. */
export class CreateProfessionalRequestDto {
  /**
   * Conta de usuário comum que recebe o perfil profissional.
   * @example 0b6f5a4e-2c1d-4e8f-9a7b-3c2d1e0f9a8b
   */
  accountId: string;

  /** @example psychologist */
  specialism: Specialism;
}
