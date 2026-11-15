// Este arquivo define e valida o corpo da atualização de contatos de suporte
// (RFPAC003). A lista enviada substitui a anterior (DP012); lista vazia
// remove todos os contatos. Os erros saem `{ status: 'VALIDATION_ERROR',
// message }` pelo pipe global.

import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { SupportContactDto } from './support-contact.dto';

const INVALID_SUPPORT_CONTACTS = 'Informe contatos de suporte válidos.';

/** Corpo do `PUT /patients/:patientId/support-contacts`. */
export class UpdateSupportContactsRequestDto {
  /** Lista completa de contatos; substitui a anterior. */
  @IsArray({ message: INVALID_SUPPORT_CONTACTS })
  @ValidateNested({ each: true, message: INVALID_SUPPORT_CONTACTS })
  @Type(() => SupportContactDto)
  supportContacts: SupportContactDto[];
}
