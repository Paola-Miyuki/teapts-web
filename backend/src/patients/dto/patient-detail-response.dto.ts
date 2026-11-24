// Este arquivo define o contrato publico do detalhe do paciente.

import { SupportContactResponseDto } from './support-contact-response.dto';
import { AuthorizedPatientResponseDto } from './get-authorized-patients-response.dto';

export class PatientDetailResponseDto extends AuthorizedPatientResponseDto {
  phone: string | null;
  cpf: string | null;

  clinicalHistory: string | null;

  surgicalHistory: string | null;

  familyHistory: string | null;

  habits: string | null;

  developmentalMilestones: string | null;

  allergies: string | null;

  noKnownAllergies: boolean;

  supportContacts: SupportContactResponseDto[];
}
