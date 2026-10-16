export interface CreatePtsPayload {
  professionalId: number;
  patientId: number;
  socialSituation: string;
  teamProfessionalIds?: number[];
}

export interface PtsSuccessResponse {
  id: number;
  patientId: number;
  responsibleProfessionalId: number;
  socialSituation: string;
  status: 'DRAFT' | string;
  createdAt: string;
  teamProfessionalIds: number[];
}

export interface PtsErrorResponse {
  status: string;
  message: string;
}

export interface PatientOption {
  id: number;
  name: string;
}

export interface ProfessionalOption {
  id: number;
  name: string;
  role: string;
}