import { request } from '@/lib/api';

export type ProfessionalSpecialism =
  'psychologist' | 'doctor' | 'physiotherapist';

export type Professional = {
  id: string;
  name: string;
  email: string;
  specialism: {
    id: ProfessionalSpecialism;
    name: string;
  };
};

export type PaginationData = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ProfessionalsResponse = {
  data: Professional[];
  pagination: PaginationData;
};

export type ProfessionalsQuery = {
  page: number;
  limit: number;
  name?: string;
  specialism?: ProfessionalSpecialism;
  ids?: string[];
};

// GET /professionals; filtros vazios não entram na query string.
export function getProfessionals({
  page,
  limit,
  name,
  specialism,
  ids = [],
}: ProfessionalsQuery) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  const trimmedName = name?.trim();

  if (trimmedName) {
    params.set('name', trimmedName);
  }

  if (specialism) {
    params.set('specialism', specialism);
  }

  const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];

  if (uniqueIds.length > 0) {
    params.set('ids', uniqueIds.join(','));
  }

  return request<ProfessionalsResponse>(`/professionals?${params.toString()}`);
}
