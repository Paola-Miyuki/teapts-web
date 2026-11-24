// Contratos publicos das medicacoes do paciente (RFPAC007).

export class MedicationResponseDto {
  id: string;

  patientId: string;

  drugName: string;

  dose: string;

  frequency: string;

  prescriber: string | null;

  reason: string | null;

  startDate: string;

  endDate: string | null;
}

export class GetMedicationsResponseDto {
  data: MedicationResponseDto[];
}
