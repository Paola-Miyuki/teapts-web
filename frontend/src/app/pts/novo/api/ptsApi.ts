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

  const params = new URLSearchParams({
    page: '1',
    limit: '100',
  });

  if (ids?.length) {
    params.set('ids', ids.join(','));
  }

  const response = await request<
    PaginatedResponse<Professional> | Professional[]
  >(`/professionals?${params.toString()}`, { signal });

  return Array.isArray(response) ? response : response.data ?? [];
}

export async function listEligiblePatients(
  signal?: AbortSignal,
): Promise<Patient[]> {
  if (USE_MOCKS) {
    return mockPatients;
  }

  const params = new URLSearchParams({
    page: '1',
    limit: '100',
  });

  const response = await request<
    PaginatedResponse<Patient> | Patient[]
  >(`/patients/authorized?${params.toString()}`, { signal });

  return Array.isArray(response) ? response : response.data ?? [];
}

export async function createPts(
  payload: CreatePtsPayload,
): Promise<Pts> {
  if (USE_MOCKS) {
    return mockCreatePts(payload);
  }

  return request<Pts>('/pts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
