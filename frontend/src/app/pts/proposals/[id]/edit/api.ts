import { apiFetch } from '@/lib/api';

import type {
  ApiErrorBody,
  Professional,
  ProfessionalsResponse,
  PtsProposal,
  UpdatePtsProposalPayload,
} from './types';

export class PtsProposalApiError extends Error {
  readonly statusCode: number;
  readonly apiStatus?: string;

  constructor(statusCode: number, message: string, apiStatus?: string) {
    super(message);

    this.name = 'PtsProposalApiError';
    this.statusCode = statusCode;
    this.apiStatus = apiStatus;
  }
}

async function createApiError(response: Response, fallbackMessage: string) {
  let body: ApiErrorBody | null = null;

  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    body = null;
  }

  const message =
    typeof body?.message === 'string' && body.message.trim()
      ? body.message
      : fallbackMessage;

  return new PtsProposalApiError(response.status, message, body?.status);
}

export async function getPtsProposal(
  proposalId: string,
  signal?: AbortSignal,
): Promise<PtsProposal> {
  const response = await apiFetch(`/pts/proposals/${proposalId}`, {
    method: 'GET',
    signal,
  });

  if (!response.ok) {
    throw await createApiError(
      response,
      'Não foi possível carregar a proposta de PTS.',
    );
  }

  return (await response.json()) as PtsProposal;
}

export async function getProfessionalsForTeam(
  signal?: AbortSignal,
): Promise<Professional[]> {
  const params = new URLSearchParams({
    page: '1',
    limit: '100',
  });

  const response = await apiFetch(`/professionals?${params.toString()}`, {
    method: 'GET',
    signal,
  });

  if (!response.ok) {
    throw await createApiError(
      response,
      'Não foi possível carregar os profissionais.',
    );
  }

  const result = (await response.json()) as ProfessionalsResponse;

  return result.data;
}

export async function updatePtsProposal(
  proposalId: string,
  payload: UpdatePtsProposalPayload,
): Promise<PtsProposal> {
  const response = await apiFetch(`/pts/proposals/${proposalId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await createApiError(
      response,
      'Não foi possível atualizar a proposta de PTS.',
    );
  }

  return (await response.json()) as PtsProposal;
}
