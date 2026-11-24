import { request } from '@/lib/api';
import type { PaginationData } from '@/lib/professionals';
import type { PtsStatus } from '@/lib/pts-status';

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

// Contato a salvar (POST); campos opcionais vazios não vão no payload.
export type SupportContactInput = {
  name: string;
  description?: string;
  email?: string;
  phone?: string;
  isEmergency?: boolean;
};

// Contato de suporte como a API devolve, com o id próprio (RFPAC003).
export type SupportContact = {
  id: string;
  name: string;
  description: string | null;
  email: string | null;
  phone: string | null;
  isEmergency: boolean;
};

// Corpo do PATCH: o que não vem fica como está; `null` limpa o campo.
export type SupportContactPatch = {
  name?: string;
  description?: string | null;
  email?: string | null;
  phone?: string | null;
  isEmergency?: boolean;
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
  supportContacts: SupportContactInput[];
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

export type PatientStatusFilter = PtsStatus | 'none';
export type PatientSort = 'name' | 'registeredAt';
export type SortOrder = 'asc' | 'desc';

export type PatientListItem = {
  id: string;
  name: string;
  socialName: string | null;
  email: string;
  cns: string | null;
  guardianName: string | null;
  registeredAt: string;
  ptsStatus: PtsStatus | null;
  activePtsId: string | null;
  // Profissional com acesso só por PTS concluído ou cancelado (RN016).
  readOnly: boolean;
};

export type PatientsListResponse = {
  data: PatientListItem[];
  pagination: PaginationData;
};

export type PatientsQuery = {
  page: number;
  limit: number;
  q?: string;
  status?: PatientStatusFilter[];
  responsibleProfessionalId?: string;
  registeredFrom?: string;
  registeredTo?: string;
  sort?: PatientSort;
  order?: SortOrder;
  signal?: AbortSignal;
};

// GET /patients/authorized: todos os pacientes para o admin; para o
// profissional, os dos PTS de que faz ou fez parte (RN016). Filtros vazios
// não entram na query.
export function getPatients({ signal, ...query }: PatientsQuery) {
  const params = new URLSearchParams();
  const term = query.q?.trim();

  if (term) {
    params.set('q', term);
  }

  if (query.status?.length) {
    params.set('status', query.status.join(','));
  }

  for (const key of [
    'responsibleProfessionalId',
    'registeredFrom',
    'registeredTo',
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

  return request<PatientsListResponse>(
    `/patients/authorized?${params.toString()}`,
    { signal },
  );
}

export type PatientDetail = PatientListItem & {
  phone: string | null;
  cpf: string | null;
  supportContacts: SupportContact[];
};

// GET /patients/:id: admin ou profissional com acesso pela RN016.
export function getPatient(id: string, signal?: AbortSignal) {
  return request<PatientDetail>(`/patients/${encodeURIComponent(id)}`, {
    signal,
  });
}

// POST /patients: cria o perfil de paciente da conta (só admin).
export function createPatient(body: CreatePatientBody) {
  return request<PatientProfile>('/patients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function supportContactsPath(patientId: string) {
  return `/patients/${encodeURIComponent(patientId)}/support-contacts`;
}

function jsonBody(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

// GET /patients/:patientId/support-contacts: admin, profissional com vínculo
// (RN016) ou o próprio paciente.
export function getSupportContacts(
  patientId: string,
  { signal }: { signal?: AbortSignal } = {},
) {
  return request<{ data: SupportContact[] }>(supportContactsPath(patientId), {
    signal,
  });
}

// POST /patients/:patientId/support-contacts: admin ou membro de PTS ativo
// (RN024).
export function createSupportContact(
  patientId: string,
  contact: SupportContactInput,
) {
  return request<SupportContact>(
    supportContactsPath(patientId),
    jsonBody('POST', contact),
  );
}

// PATCH /patients/:patientId/support-contacts/:contactId.
export function updateSupportContact(
  patientId: string,
  contactId: string,
  patch: SupportContactPatch,
) {
  return request<SupportContact>(
    `${supportContactsPath(patientId)}/${encodeURIComponent(contactId)}`,
    jsonBody('PATCH', patch),
  );
}

// DELETE /patients/:patientId/support-contacts/:contactId (204).
export function deleteSupportContact(patientId: string, contactId: string) {
  return request<void>(
    `${supportContactsPath(patientId)}/${encodeURIComponent(contactId)}`,
    { method: 'DELETE' },
  );
}
