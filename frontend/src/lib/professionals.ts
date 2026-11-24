import { request } from '@/lib/api';

export type ProfessionalSpecialism =
  'psychologist' | 'doctor' | 'physiotherapist';

// Registro no conselho regional; o conselho vem da especialidade.
export type ProfessionalRegistration = {
  council: string;
  number: string;
  state: string;
};

export type ProfessionalStatus = 'active' | 'inactive';

export type Professional = {
  id: string;
  name: string;
  // Só vem para o admin e o profissional (DP011).
  email: string | null;
  specialism: {
    id: ProfessionalSpecialism;
    name: string;
  };
  // Nulos nos perfis cadastrados antes do registro no conselho.
  registration: ProfessionalRegistration | null;
  institution: string | null;
  cnes: string | null;
  // Situação da conta; só o admin recebe os inativos.
  status: ProfessionalStatus;
};

/** Registro como nas telas, ex.: "CRP-PR 12345". */
export function formatRegistration(registration: ProfessionalRegistration) {
  return `${registration.council}-${registration.state} ${registration.number}`;
}

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

// Siglas das UFs do registro no conselho (mesma lista do backend).
export const COUNCIL_STATES = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const;

export type ProfessionalCouncil = 'CRP' | 'CRM' | 'Crefito';

export type ProfessionalSort = 'name' | 'specialism';

export type ProfessionalsQuery = {
  page: number;
  limit: number;
  q?: string;
  // Alias de `q`, para quem ainda usa o nome antigo do parâmetro.
  name?: string;
  specialism?: ProfessionalSpecialism[];
  council?: ProfessionalCouncil[];
  councilState?: string;
  // Só o admin filtra por situação.
  status?: ProfessionalStatus[];
  sort?: ProfessionalSort;
  order?: 'asc' | 'desc';
  ids?: string[];
};

// GET /professionals; filtros vazios não entram na query string.
export function getProfessionals(
  {
    page,
    limit,
    q,
    name,
    specialism = [],
    council = [],
    councilState,
    status = [],
    sort,
    order,
    ids = [],
  }: ProfessionalsQuery,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  const term = (q ?? name)?.trim();

  if (term) {
    params.set('q', term);
  }

  if (specialism.length > 0) {
    params.set('specialism', specialism.join(','));
  }

  if (council.length > 0) {
    params.set('council', council.join(','));
  }

  if (councilState) {
    params.set('councilState', councilState);
  }

  if (status.length > 0) {
    params.set('status', status.join(','));
  }

  if (sort) {
    params.set('sort', sort);
  }

  if (order) {
    params.set('order', order);
  }

  const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];

  if (uniqueIds.length > 0) {
    params.set('ids', uniqueIds.join(','));
  }

  return request<ProfessionalsResponse>(
    `/professionals?${params.toString()}`,
    signal ? { signal } : undefined,
  );
}
