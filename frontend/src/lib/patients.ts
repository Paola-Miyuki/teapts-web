import { request } from '@/lib/api';
import type { PaginationData } from '@/lib/professionals';

export type AccountOption = {
  id: string;
  name: string;
  email: string;
};

// Busca `q` por nome ou e-mail (NFUS003) e `signal` para cancelar a consulta.
export type AccountsSearch = {
  q?: string;
  signal?: AbortSignal;
};

export type AccountsResponse = {
  data: AccountOption[];
  pagination: PaginationData;
};

// Campos opcionais vazios não vão no payload.
export type SupportContact = {
  name: string;
  description?: string;
  email?: string;
  phone?: string;
};

// Telefone com DDD (10 ou 11 dígitos), com ou sem +55, aceitando a máscara
// "(11) 98765-4321".
export function isValidPhone(phone: string) {
  if (!/^\+?[\d\s().-]+$/.test(phone)) {
    return false;
  }

  const digits = phone.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');

  return digits.length === 10 || digits.length === 11;
}

export type CreatePatientBody = {
  accountId: string;
  supportContacts: SupportContact[];
};

export type PatientProfile = CreatePatientBody;

// Monta a query do GET /accounts: filtros de perfil, `q` (só se houver texto),
// página e limite, nessa ordem.
function buildAccountsQuery(
  filters: Record<string, string>,
  q: string | undefined,
  page: number,
  limit: number,
) {
  const params = new URLSearchParams(filters);
  const term = q?.trim();

  if (term) {
    params.set('q', term);
  }

  params.set('page', String(page));
  params.set('limit', String(limit));

  return params.toString();
}

// GET /accounts: contas com perfil de paciente, paginadas (só admin).
export function getPatientAccounts(
  page: number,
  limit: number,
  { q, signal }: AccountsSearch = {},
) {
  return request<AccountsResponse>(
    `/accounts?${buildAccountsQuery({ isPatient: 'true' }, q, page, limit)}`,
    { signal },
  );
}

// GET /accounts: 1ª página das contas sem perfil de paciente nem profissional
// (só admin). Paciente e profissional usam contas separadas (RN002).
export function getAccountsWithoutProfile({ q, signal }: AccountsSearch = {}) {
  return request<AccountsResponse>(
    `/accounts?${buildAccountsQuery(
      { isPatient: 'false', isProfessional: 'false' },
      q,
      1,
      20,
    )}`,
    { signal },
  );
}

// POST /patients: cria o perfil de paciente da conta (só admin).
export function createPatient(body: CreatePatientBody) {
  return request<PatientProfile>('/patients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
