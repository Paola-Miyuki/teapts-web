import { ApiError } from './http';
import type {
  CreatePtsPayload,
  Patient,
  Professional,
  Pts,
  PtsProfessional,
} from '../types';

export const MOCK_PROFESSIONAL_ID = 'e24f123a-ce91-4ef2-a0c5-3d196e2515a9';
export const MOCK_PATIENT_ID = '00000000-0000-4000-8000-000000000025';
export const MOCK_PATIENT_WITH_ACTIVE_PTS_ID =
  '00000000-0000-4000-8000-000000000026';

/** Mapeia todos os UUIDs possíveis do perfil da Felícia Santiago e outros profissionais */
export const mockProfessionals: Professional[] = [
  {
    id: 'e24f123a-ce91-4ef2-a0c5-3d196e2515a9', // ID do perfil no banco
    name: 'felicia santiagoo',
    email: 'flavialopesfc3@gmail.com',
    specialism: { id: 'doctor', name: 'Medicina' },
  },
  {
    id: 'efc9ad9c-ba7f-4a62-810b-e4d4e5bcc25c', // accountId da sessão
    name: 'felicia santiagoo',
    email: 'flavialopesfc3@gmail.com',
    specialism: { id: 'doctor', name: 'Medicina' },
  },
  {
    id: '00000000-0000-4000-8000-000000000010', // ID legado de testes
    name: 'felicia santiagoo',
    email: 'flavialopesfc3@gmail.com',
    specialism: { id: 'doctor', name: 'Medicina' },
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
];

export const mockMe = mockProfessionals[0];

export const mockPatients: Patient[] = [
  { id: MOCK_PATIENT_ID, name: 'Maria Silva' },
  { id: MOCK_PATIENT_WITH_ACTIVE_PTS_ID, name: 'Diego Alves' },
  { id: '00000000-0000-4000-8000-000000000027', name: 'Priscila Martins' },
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
  await wait(500);

  // 1. Procura se o ID enviado (qualquer uma das variantes) pertence aos autorizados
  const responsible = mockProfessionals.find(
    (item) => item.id === payload.professionalId,
  );

  if (!responsible) {
    throw new ApiError(
      403,
      'FORBIDDEN',
      'O professionalId informado não pertence à conta autenticada.',
    );
  }

  // 2. Validação RN008: Paciente
  const patient = mockPatients.find(
    (item) => item.id === payload.patientId,
  ) ?? {
    id: payload.patientId,
    name: 'Paciente Selecionado',
  };

  // 3. Validação RN011: PTS Ativo
  if (payload.patientId === MOCK_PATIENT_WITH_ACTIVE_PTS_ID) {
    throw new ApiError(
      409,
      'ACTIVE_PTS_ALREADY_EXISTS',
      'O paciente já possui um PTS aprovado ativo.',
    );
  }

  // 4. Montagem da equipa sem duplicar o responsável
  const team = (payload.teamProfessionalIds ?? [])
    .filter((id) => id !== payload.professionalId)
    .flatMap((id) => {
      const professional = mockProfessionals.find((item) => item.id === id);
      return professional ? [toPtsProfessional(professional)] : [];
    });

  return {
    id: `pts-${Date.now()}`,
    status: 'draft',
    socialSituation: payload.socialSituation,
    createdAt: new Date().toISOString(),
    patient,
    responsible: toPtsProfessional(responsible),
    team,
  };
}
