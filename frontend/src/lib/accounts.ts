import { request } from '@/lib/api';
import type { Gender, Sex } from '@/lib/account';
import type { PaginationData } from '@/lib/professionals';

// Contas da tela Contas do admin (`contas.html`, RN032).
export type AccountProfileFilter =
  'none' | 'patient' | 'professional' | 'admin';
export type AccountStatus = 'active' | 'inactive';
export type AccountSort = 'name' | 'createdAt';
export type AccountOrder = 'asc' | 'desc';

export const PROFILE_FILTERS: { value: AccountProfileFilter; label: string }[] =
  [
    { value: 'none', label: 'Sem perfil' },
    { value: 'patient', label: 'Paciente' },
    { value: 'professional', label: 'Profissional' },
    { value: 'admin', label: 'Administrador' },
  ];

export type AccountListItem = {
  id: string;
  name: string;
  socialName: string | null;
  email: string;
  // Só dígitos; a conta de admin não tem CPF.
  cpf: string | null;
  role: 'user' | 'admin';
  profile: AccountProfileFilter;
  specialisms: string[];
  status: AccountStatus;
  createdAt: string;
};

export type AccountsListResponse = {
  data: AccountListItem[];
  pagination: PaginationData;
};

export type AccountsListQuery = {
  page: number;
  limit: number;
  q?: string;
  profile?: AccountProfileFilter[];
  status?: AccountStatus | '';
  createdFrom?: string;
  createdTo?: string;
  sort?: AccountSort;
  order?: AccountOrder;
  signal?: AbortSignal;
};

// GET /accounts (só admin); filtros vazios não entram na query.
export function getAccounts({ signal, ...query }: AccountsListQuery) {
  const params = new URLSearchParams();
  const term = query.q?.trim();

  if (term) {
    params.set('q', term);
  }

  if (query.profile?.length) {
    params.set('profile', query.profile.join(','));
  }

  for (const key of [
    'status',
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

  return request<AccountsListResponse>(`/accounts?${params.toString()}`, {
    signal,
  });
}

export type AccountDetail = {
  id: string;
  fullName: string;
  socialName: string | null;
  birthDate: string | null;
  sex: Sex | null;
  gender: Gender | null;
  cpf: string | null;
  email: string;
  phone: string | null;
  role: 'user' | 'admin';
  status: AccountStatus;
  createdAt: string;
  updatedAt: string | null;
  profile: { type: AccountProfileFilter; specialisms: string[] };
};

// GET /accounts/:id (só admin).
export function getAccount(id: string, signal?: AbortSignal) {
  return request<AccountDetail>(`/accounts/${encodeURIComponent(id)}`, {
    signal,
  });
}

export type DeactivateAccountResponse = {
  id: string;
  status: AccountStatus;
  deactivatedAt: string;
};

// DELETE /accounts/:id: desativa a conta e encerra as sessões. 409
// `ACCOUNT_IS_PTS_RESPONSIBLE` e `ACCOUNT_ALREADY_DEACTIVATED` trazem a
// `message` para mostrar.
export function deactivateAccount(id: string) {
  return request<DeactivateAccountResponse>(
    `/accounts/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
}
