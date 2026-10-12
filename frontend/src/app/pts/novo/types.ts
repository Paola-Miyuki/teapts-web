export interface Patient {
  id: number;
  name: string;
}

export interface Professional {
  id: number;
  name: string;
  specialty: string;
}

export interface CreatePtsPayload {
  professionalId: number;
  patientId: number;
  socialSituation: string;
  teamProfessionalIds: number[];
}

export interface Pts {
  id: number;
  patientId: number;
  responsibleProfessionalId: number;
  socialSituation: string;
  status: 'DRAFT' | string;
  createdAt: string;
  teamProfessionalIds: number[];
}
