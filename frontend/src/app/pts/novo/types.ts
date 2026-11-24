export interface Patient {
  id: string;
  name: string;
}

// Paciente da busca de elegíveis (RN011); o CPF não vem da API (DP011).
export interface EligiblePatient extends Patient {
  email: string;
}

export interface Professional {
  id: string;
  name: string;
  email: string;
  specialism: {
    id: string;
    name: string;
  };
}

export interface PtsProfessional {
  id: string;
  name: string;
  specialism: {
    id: string;
    name: string;
  };
}

export interface CreatePtsPayload {
  professionalId: string;
  patientId: string;
  socialSituation: string;
  teamProfessionalIds: string[];
}

export type PtsStatus =
  'draft' | 'planning' | 'running' | 'concluded' | 'cancelled' | 'rejected';

export interface Pts {
  id: string;
  status: PtsStatus;
  socialSituation: string;
  createdAt: string;
  patient: Patient;
  responsible: PtsProfessional;
  team: PtsProfessional[];
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
