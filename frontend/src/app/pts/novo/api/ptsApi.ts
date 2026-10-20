import { request } from './http';
import {
  mockCreatePts,
  mockMe,
  mockPatients,
  mockProfessionals,
} from './mocks';
import type { CreatePtsPayload, Patient, Professional, Pts } from '../types';

const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === 'true';

// Rotas de apoio assumidas — ajuste conforme o backend.
export const getCurrentProfessional = (
  signal?: AbortSignal,
): Promise<Professional> =>
  USE_MOCKS
    ? Promise.resolve(mockMe)
    : request<Professional>('/professionals/me', { signal });

export const listEligiblePatients = (
  signal?: AbortSignal,
): Promise<Patient[]> =>
  USE_MOCKS
    ? Promise.resolve(mockPatients)
    : request<Patient[]>('/patients?eligibleForPts=true', { signal });

export const listProfessionals = (
  signal?: AbortSignal,
): Promise<Professional[]> =>
  USE_MOCKS
    ? Promise.resolve(mockProfessionals)
    : request<Professional[]>('/professionals', { signal });

export const createPts = (payload: CreatePtsPayload): Promise<Pts> =>
  USE_MOCKS
    ? mockCreatePts(payload)
    : request<Pts>('/pts', { method: 'POST', body: JSON.stringify(payload) });
