import { request } from './http';
import {
  mockCreatePts,
  mockPatientEmail,
  mockPatients,
  mockProfessionals,
} from './mocks';
import type {
  CreatePtsPayload,
  EligiblePatient,
  PaginatedResponse,
  Professional,
  Pts,
} from '../types';

const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === 'true';

export async function listProfessionals(
  signal?: AbortSignal,
  ids?: string[],
): Promise<Professional[]> {
  if (USE_MOCKS) {
    return mockProfessionals.filter(
      (professional) => !ids || ids.includes(professional.id),
    );
  }

  // 50 é o máximo da paginação compartilhada (NF).
  const params = new URLSearchParams({
    page: '1',
    limit: '50',
  });

  if (ids?.length) {
    params.set('ids', ids.join(','));
  }

  const response = await request<
    PaginatedResponse<Professional> | Professional[]
  >(`/professionals?${params.toString()}`, { signal });

  return Array.isArray(response) ? response : (response.data ?? []);
}

// Pacientes elegíveis para uma proposta (RN011), buscados no servidor por
// nome, nome social, e-mail ou CPF (NFUS003); o CPF não volta na resposta.
export async function listEligiblePatients({
  q,
  signal,
}: {
  q?: string;
  signal?: AbortSignal;
} = {}): Promise<EligiblePatient[]> {
  const term = q?.trim() ?? '';

  if (USE_MOCKS) {
    return mockPatients
      .filter((patient) =>
        patient.name.toLowerCase().includes(term.toLowerCase()),
      )
      .map((patient) => ({ ...patient, email: mockPatientEmail(patient) }));
  }

  const params = new URLSearchParams({
    withActivePts: 'false',
    page: '1',
    limit: '20',
  });

  if (term) {
    params.set('q', term);
  }

  const response = await request<PaginatedResponse<EligiblePatient>>(
    `/patients?${params.toString()}`,
    { signal },
  );

  return response.data ?? [];
}

export async function createPts(payload: CreatePtsPayload): Promise<Pts> {
  if (USE_MOCKS) {
    return mockCreatePts(payload);
  }

  return request<Pts>('/pts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
