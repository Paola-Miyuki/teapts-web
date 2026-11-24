// Contrato publico dos dados clinicos do paciente (RFPAC007).

export class ClinicalDataResponseDto {
  patientId: string;

  clinicalHistory: string | null;

  surgicalHistory: string | null;

  familyHistory: string | null;

  habits: string | null;

  developmentalMilestones: string | null;

  allergies: string | null;

  noKnownAllergies: boolean;
}
