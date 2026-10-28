// Este arquivo define o contrato público do perfil de paciente criado.

import { SupportContactDto } from './support-contact.dto';

/** Perfil de paciente criado. */
export class PatientResponseDto {
  /** @example 0b6f5a4e-2c1d-4e8f-9a7b-3c2d1e0f9a8b */
  accountId: string;
  supportContacts: SupportContactDto[];
}
