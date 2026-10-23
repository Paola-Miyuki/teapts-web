import { ApiError } from './http';
import type {
  CreatePtsPayload,
  Patient,
  Professional,
  Pts,
  PtsProfessional,
} from '../types';

export const MOCK_PROFESSIONAL_ID = '00000000-0000-4000-8000-000000000010';

export const MOCK_PATIENT_ID = '00000000-0000-4000-8000-000000000025';

export const MOCK_PATIENT_WITH_ACTIVE_PTS_ID =
  '00000000-0000-4000-8000-000000000026';

export const mockProfessionals: Professional[] = [
  {
    id: MOCK_PROFESSIONAL_ID,
    name: 'Kaio Felipe',
    email: 'kaio@example.com',
    specialism: { id: 'psychologist', name: 'Psicologia' },
  },
  {
    id: '00000000-0000-4000-8000-000000000011',
    name: 'Ana Lima',
    email: 'ana@example.com',
    specialism: { id: 'doctor', name: 'Medicina' },
  },
  {
    id: '00000000-0000-4000-8000-000000000015',
    name: 'Bruno Souza',
    email: 'bruno@example.com',
    specialism: { id: 'physiotherapist', name: 'Fisioterapia' },
  },
  {
    id: '00000000-0000-4000-8000-000000000016',
    name: 'Kaio Felipe',
    email: 'kaio.outro@example.com',
    specialism: { id: 'doctor', name: 'Medicina' },
  },
];

export const mockMe = mockProfessionals[0];

export const mockPatients: Patient[] = [
  { id: MOCK_PATIENT_ID, name: 'Maria Silva' },
  {
    id: MOCK_PATIENT_WITH_ACTIVE_PTS_ID,
    name: 'Diego Alves',
  },
  {
    id: '00000000-0000-4000-8000-000000000027',
    name: 'Priscila Martins',
  },
];

function toPtsProfessional(professional: Professional): PtsProfessional {
  return {
    id: professional.id,
    name: professional.name,
    specialism: professional.specialism,
  };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function mockCreatePts(payload: CreatePtsPayload): Promise<Pts> {
  await wait(700);

  if (payload.patientId === MOCK_PATIENT_WITH_ACTIVE_PTS_ID) {
    throw new ApiError(
      409,
      'PTS_ACTIVE_EXISTS',
      'O paciente já possui um PTS aprovado e ativo.',
    );
  }

  const patient = mockPatients.find((item) => item.id === payload.patientId);
  const responsible = mockProfessionals.find(
    (item) => item.id === payload.professionalId,
  );

  if (!patient) {
    throw new ApiError(404, 'PATIENT_NOT_FOUND', 'Paciente não encontrado.');
  }

  if (!responsible) {
    throw new ApiError(
      403,
      'PROFESSIONAL_NOT_AUTHORIZED',
      'Perfil profissional não autorizado.',
    );
  }

  const team = payload.teamProfessionalIds.flatMap((id) => {
    const professional = mockProfessionals.find((item) => item.id === id);

    return professional ? [toPtsProfessional(professional)] : [];
  });

  return {
    id: '00000000-0000-4000-8000-000000000100',
    status: 'draft',
    socialSituation: payload.socialSituation,
    createdAt: new Date().toISOString(),
    patient,
    responsible: toPtsProfessional(responsible),
    team,
  };
}
