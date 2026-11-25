import type { Gender, Sex } from '@/lib/account';
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

export type Medication = {
  id: string;
  patientId: string;
  drugName: string;
  dose: string;
  frequency: string;
  prescriber: string | null;
  reason: string | null;
  startDate: string;
  endDate: string | null;
};

export type MedicationInput = {
  drugName: string;
  dose: string;
  frequency: string;
  prescriber?: string;
  reason?: string;
  startDate: string;
  endDate?: string;
};

export type MedicationsResponse = {
  data: Medication[];
};
export type ClinicalData = {
  allergies: string | null;
  noKnownAllergies: boolean;
  clinicalHistory: string | null;
  surgicalHistory: string | null;
  familyHistory: string | null;
  habits: string | null;
  developmentalMilestones: string | null;
};

export type ClinicalDataPatch = {
  allergies?: string;
  noKnownAllergies?: boolean;
  clinicalHistory?: string;
  surgicalHistory?: string;
  familyHistory?: string;
  habits?: string;
  developmentalMilestones?: string;
};

export type EducationLevel =
  | 'early_childhood_daycare'
  | 'early_childhood_preschool'
  | 'elementary_incomplete'
  | 'elementary_ongoing'
  | 'elementary_complete'
  | 'high_school_incomplete'
  | 'high_school_ongoing'
  | 'high_school_complete'
  | 'technical_incomplete'
  | 'technical_ongoing'
  | 'technical_complete'
  | 'undergraduate_incomplete'
  | 'undergraduate_ongoing'
  | 'undergraduate_complete'
  | 'postgraduate_specialization'
  | 'postgraduate_mba'
  | 'postgraduate_masters'
  | 'postgraduate_doctorate';

// Escolaridade, com os grupos de propriedades-front.md (3.2).
export const EDUCATION_LABELS: Record<EducationLevel, string> = {
  early_childhood_daycare: 'Educação Infantil, creche',
  early_childhood_preschool: 'Educação Infantil, pré-escola',
  elementary_incomplete: 'Ensino Fundamental incompleto',
  elementary_ongoing: 'Ensino Fundamental cursando',
  elementary_complete: 'Ensino Fundamental completo',
  high_school_incomplete: 'Ensino Médio incompleto',
  high_school_ongoing: 'Ensino Médio cursando',
  high_school_complete: 'Ensino Médio completo',
  technical_incomplete: 'Técnico / Profissionalizante incompleto',
  technical_ongoing: 'Técnico / Profissionalizante cursando',
  technical_complete: 'Técnico / Profissionalizante concluído',
  undergraduate_incomplete: 'Ensino Superior incompleta',
  undergraduate_ongoing: 'Ensino Superior cursando',
  undergraduate_complete: 'Ensino Superior concluída',
  postgraduate_specialization: 'Pós-graduação, especialização',
  postgraduate_mba: 'Pós-graduação, MBA',
  postgraduate_masters: 'Pós-graduação, mestrado',
  postgraduate_doctorate: 'Pós-graduação, doutorado',
};

export type PatientAddress = {
  // CEP, 8 dígitos.
  zipCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  // Sigla em minúsculas (`uf_e`).
  state: string | null;
};

// Diagnóstico em comum do PTS atual (RN030).
export type PatientDiagnosis = {
  ptsId: string;
  ptsStatus: PtsStatus;
  // `AAAA-MM-DD`.
  caseStudyDate: string;
  cid: string | null;
  supportLevel: number | null;
  summary: string;
  strengths: string | null;
  priorityNeeds: string[];
  socialSituation: string;
};

// Selo do cartão do paciente: aberta de 30 dias antes da próxima revisão até
// a data, vencida depois (RN031).
export type PatientReassessment = {
  status: 'open' | 'overdue';
  // `AAAA-MM-DD`.
  nextReviewAt: string;
};

export type PatientDetail = PatientListItem &
  ClinicalData & {
    phone: string | null;
    cpf: string | null;
    // `AAAA-MM-DD`.
    birthDate: string | null;
    sex: Sex | null;
    gender: Gender | null;
    filiation1: string | null;
    filiation2: string | null;
    address: PatientAddress;
    guardianPhone: string | null;
    educationLevel: EducationLevel | null;
    schoolName: string | null;
    referenceUnit: string | null;
    supportContacts: SupportContact[];
    diagnosis: PatientDiagnosis | null;
    reassessment: PatientReassessment | null;
    // `false` mostra o selo "Sem TCLE".
    hasTcle: boolean;
  };

// Corpo do PATCH /patients/:id; o que não vai fica como está, e `null` limpa o
// campo opcional. Os dados da conta (nome, e-mail e CPF) só o admin altera.
export type UpdatePatientInput = {
  name?: string;
  socialName?: string | null;
  birthDate?: string;
  sex?: Sex;
  cpf?: string;
  phone?: string | null;
  email?: string;
  guardianName?: string | null;
  guardianPhone?: string | null;
  address?: Partial<{
    zipCode: string;
    street: string;
    number: string;
    complement: string | null;
    district: string;
    city: string;
    state: string;
  }>;
  filiation1?: string;
  filiation2?: string | null;
  referenceUnit?: string | null;
  educationLevel?: EducationLevel | null;
  schoolName?: string | null;
};

// PATCH /patients/:id ("Editar paciente"): admin (também a conta) ou
// profissional de PTS ativo (RN024, só os dados do paciente). Devolve o
// paciente atualizado.
export function updatePatient(patientId: string, input: UpdatePatientInput) {
  return request<PatientDetail>(
    `/patients/${encodeURIComponent(patientId)}`,
    jsonBody('PATCH', input),
  );
}

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

// PATCH /patients/:id/clinical-data: admin ou profissional membro de PTS ativo
// do paciente (RFPAC007, RN024).
export function updateClinicalData(
  patientId: string,
  patch: ClinicalDataPatch,
) {
  return request<ClinicalData>(
    `/patients/${encodeURIComponent(patientId)}/clinical-data`,
    jsonBody('PATCH', patch),
  );
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

// GET /patients/:id/medications: consulta as medicações do paciente.
export function getMedications(patientId: string, signal?: AbortSignal) {
  return request<MedicationsResponse>(
    `/patients/${encodeURIComponent(patientId)}/medications`,
    { signal },
  );
}

// POST /patients/:id/medications: cadastra uma medicação.
export function createMedication(
  patientId: string,
  medication: MedicationInput,
) {
  return request<Medication>(
    `/patients/${encodeURIComponent(patientId)}/medications`,
    jsonBody('POST', medication),
  );
}

// PATCH /patients/:id/medications/:medicationId: edita uma medicação.
export function updateMedication(
  patientId: string,
  medicationId: string,
  medication: MedicationInput,
) {
  return request<Medication>(
    `/patients/${encodeURIComponent(patientId)}/medications/${encodeURIComponent(
      medicationId,
    )}`,
    jsonBody('PATCH', medication),
  );
}

// POST /patients/:id/medications/:medicationId/stop: suspende sem excluir.
export function stopMedication(patientId: string, medicationId: string) {
  return request<Medication>(
    `/patients/${encodeURIComponent(patientId)}/medications/${encodeURIComponent(
      medicationId,
    )}/stop`,
    { method: 'POST' },
  );
}
