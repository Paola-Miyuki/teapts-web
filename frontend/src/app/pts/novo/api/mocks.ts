import { ApiError } from './http';
import type { CreatePtsPayload, Patient, Professional, Pts } from '../types';

// Dados de demonstração. Ative com NEXT_PUBLIC_USE_MOCKS=true no .env.local
export const mockMe: Professional = { id: 10, name: 'Kaio Felipe', specialty: 'Psicólogo(a)' };

export const mockPatients: Patient[] = [
  { id: 1, name: 'Maria Sílvia Barreto Pessoa de Moraes' },
  { id: 2, name: 'Diego Alves' }, // simula PTS_ACTIVE_EXISTS
  { id: 3, name: 'Priscila Martins' },
];

export const mockProfessionals: Professional[] = [
  mockMe,
  { id: 11, name: 'Kaio Felipe', specialty: 'Médico(a)' },
  { id: 12, name: 'Kaio Felipe', specialty: 'Fisioterapeuta' },
  { id: 13, name: 'Kaio Segunda Conta', specialty: 'Psicólogo(a)' },
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function mockCreatePts(payload: CreatePtsPayload): Promise<Pts> {
  await wait(700);
  if (payload.patientId === 2) {
    throw new ApiError(409, 'PTS_ACTIVE_EXISTS', 'O paciente já possui um PTS aprovado e ativo.');
  }
  return {
    id: 100,
    patientId: payload.patientId,
    responsibleProfessionalId: payload.professionalId,
    socialSituation: payload.socialSituation,
    status: 'DRAFT',
    createdAt: new Date().toISOString(),
    teamProfessionalIds: payload.teamProfessionalIds,
  };
}
