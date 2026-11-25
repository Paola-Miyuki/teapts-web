import { request } from '@/lib/api';
import type { PaginationData } from '@/lib/professionals';
import type { PtsStatus } from '@/lib/pts-status';

export type PtsListProfessional = {
  id: string;
  name: string;
  specialism: { id: string; name: string };
};

export type PtsListItem = {
  id: string;
  status: PtsStatus;
  // Ordem do PTS entre os do paciente ("2º PTS").
  version: number;
  createdAt: string;
  beganAt: string | null;
  // Conclusão ou cancelamento.
  closedAt: string | null;
  patient: { id: string; name: string };
  responsible: PtsListProfessional;
  team: PtsListProfessional[];
};

export type PtsListResponse = {
  data: PtsListItem[];
  pagination: PaginationData;
};

export type PtsListSort = 'createdAt' | 'status';
export type PtsListOrder = 'asc' | 'desc';

export type PtsListQuery = {
  page: number;
  limit: number;
  q?: string;
  status?: PtsStatus[];
  responsibleId?: string;
  memberId?: string;
  createdFrom?: string;
  createdTo?: string;
  sort?: PtsListSort;
  order?: PtsListOrder;
  signal?: AbortSignal;
};

// GET /pts: o admin vê todos os PTS; o profissional, os de que é responsável
// ou membro. Filtros vazios não entram na query.
export function getPtsList({ signal, ...query }: PtsListQuery) {
  const params = new URLSearchParams();
  const term = query.q?.trim();

  if (term) {
    params.set('q', term);
  }

  if (query.status?.length) {
    params.set('status', query.status.join(','));
  }

  for (const key of [
    'responsibleId',
    'memberId',
    'createdFrom',
    'createdTo',
    'sort',
    'order',
  ] as const) {
    const value = query[key];

    if (value) {
      params.set(key, value);
    }
  }

  params.set('page', String(query.page));
  params.set('limit', String(query.limit));

  return request<PtsListResponse>(`/pts?${params.toString()}`, { signal });
}
