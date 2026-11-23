// Este arquivo define o contrato público do detalhe do paciente.

import { SupportContactDto } from './support-contact.dto';
import { AuthorizedPatientResponseDto } from './get-authorized-patients-response.dto';

export class PatientDetailResponseDto extends AuthorizedPatientResponseDto {
  cpf: string | null;
  supportContacts: SupportContactDto[];
}
