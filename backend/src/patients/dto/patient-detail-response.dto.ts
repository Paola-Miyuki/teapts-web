// Este arquivo define o contrato público do detalhe do paciente.

import { SupportContactResponseDto } from './support-contact-response.dto';
import { AuthorizedPatientResponseDto } from './get-authorized-patients-response.dto';

export class PatientDetailResponseDto extends AuthorizedPatientResponseDto {
  phone: string | null;
  cpf: string | null;
  supportContacts: SupportContactResponseDto[];
}
