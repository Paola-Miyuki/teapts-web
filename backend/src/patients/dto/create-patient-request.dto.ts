// Este arquivo define e valida o corpo do cadastro de perfil de paciente.
// Os erros saem `{ status: 'VALIDATION_ERROR', message }` pelo pipe global.

import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { SupportContactDto } from './support-contact.dto';

const INVALID_SUPPORT_CONTACTS = 'Informe contatos de suporte válidos.';

/** Corpo do `POST /patients`. */
export class CreatePatientRequestDto {
  /**
   * Conta que recebe o perfil de paciente.
   * @example 0b6f5a4e-2c1d-4e8f-9a7b-3c2d1e0f9a8b
   */
  @IsUUID('all', { message: 'Informe uma conta válida.' })
  accountId: string;

  @IsOptional()
  @IsArray({ message: INVALID_SUPPORT_CONTACTS })
  @ValidateNested({ each: true, message: INVALID_SUPPORT_CONTACTS })
  @Type(() => SupportContactDto)
  supportContacts?: SupportContactDto[];
}
