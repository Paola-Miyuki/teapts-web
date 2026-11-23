import { request } from './http';
import { mockCreatePts, mockPatients, mockProfessionals } from './mocks';
import type {
  CreatePtsPayload,
  PaginatedResponse,
  Patient,
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

// Pacientes sem PTS ativo, buscados pelo nome com a paginação padrão (20);
// a busca completa (CPF, CNS) entra com a #80/#81.
export async function listEligiblePatients(
  signal?: AbortSignal,
  name?: string,
): Promise<Patient[]> {
  const term = name?.trim() ?? '';

  if (USE_MOCKS) {
    return mockPatients.filter((patient) =>
      patient.name.toLowerCase().includes(term.toLowerCase()),
    );
  }

  const params = new URLSearchParams({ page: '1', limit: '20' });

  if (term) {
    params.set('name', term);
  }

  const response = await request<PaginatedResponse<Patient> | Patient[]>(
    `/patients/available-for-pts?${params.toString()}`,
    { signal },
  );

  return Array.isArray(response) ? response : (response.data ?? []);
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
