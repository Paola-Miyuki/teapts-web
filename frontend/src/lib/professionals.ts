import { request } from '@/lib/api';

// Lista fixa de especialidades do app (`specialism_e`), com o conselho regional
// de cada uma (tabela de profissões do propriedades-front.md).
export const SPECIALISMS = [
  { value: 'doctor', label: 'Médico', council: 'CRM' },
  {
    value: 'family_doctor',
    label: 'Médico de família e comunidade',
    council: 'CRM',
  },
  { value: 'pediatrician', label: 'Pediatra', council: 'CRM' },
  { value: 'neuropediatrician', label: 'Neuropediatra', council: 'CRM' },
  { value: 'neurologist', label: 'Neurologista', council: 'CRM' },
  {
    value: 'child_psychiatrist',
    label: 'Psiquiatra da infância e adolescência',
    council: 'CRM',
  },
  { value: 'geneticist', label: 'Geneticista', council: 'CRM' },
  { value: 'nurse', label: 'Enfermeiro', council: 'Coren' },
  {
    value: 'nursing_technician',
    label: 'Técnico de enfermagem',
    council: 'Coren',
  },
  { value: 'psychologist', label: 'Psicólogo', council: 'CRP' },
  { value: 'neuropsychologist', label: 'Neuropsicólogo', council: 'CRP' },
  { value: 'social_worker', label: 'Assistente social', council: 'CRESS' },
  { value: 'nutritionist', label: 'Nutricionista', council: 'CRN' },
  { value: 'physiotherapist', label: 'Fisioterapeuta', council: 'Crefito' },
  {
    value: 'occupational_therapist',
    label: 'Terapeuta ocupacional',
    council: 'Crefito',
  },
  { value: 'pharmacist', label: 'Farmacêutico', council: 'CRF' },
  { value: 'speech_therapist', label: 'Fonoaudiólogo', council: 'CRFa' },
  { value: 'dentist', label: 'Cirurgião-dentista', council: 'CRO' },
  { value: 'pediatric_dentist', label: 'Odontopediatra', council: 'CRO' },
  {
    value: 'physical_education_professional',
    label: 'Profissional de educação física',
    council: 'CREF',
  },
] as const;

export type ProfessionalSpecialism = (typeof SPECIALISMS)[number]['value'];

// Conselhos regionais da lista fixa.
export const COUNCILS = [
  'CRM',
  'Coren',
  'CRP',
  'CRESS',
  'CRN',
  'Crefito',
  'CRF',
  'CRFa',
  'CRO',
  'CREF',
] as const;

export type ProfessionalCouncil = (typeof COUNCILS)[number];

/** Conselho regional da especialidade; vazio enquanto nada foi escolhido. */
export function councilOf(specialism: string) {
  return SPECIALISMS.find((item) => item.value === specialism)?.council ?? '';
}

// Registro no conselho regional; o conselho vem da especialidade.
export type ProfessionalRegistration = {
  council: string;
  number: string;
  state: string;
};

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
};

/** Registro como nas telas, ex.: "CRP-PR 12345". */
export function formatRegistration(registration: ProfessionalRegistration) {
  // A API devolve a UF em minúsculas (`uf_e`); as telas mostram em maiúsculas.
  return `${registration.council}-${registration.state.toUpperCase()} ${registration.number}`;
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
    // As telas usam a sigla em maiúsculas; a API recebe em minúsculas.
    params.set('councilState', councilState.toLowerCase());
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

// POST /professionals (só admin): a conta passa a ter o perfil profissional.
// A UF vai em minúsculas (`uf_e`); instituição e CNES vazios nem são enviados.
export type CreateProfessionalInput = {
  accountId: string;
  specialism: ProfessionalSpecialism;
  councilNumber: string;
  councilState: string;
  institution?: string;
  cnes?: string;
};

export function createProfessional(input: CreateProfessionalInput) {
  const institution = input.institution?.trim();
  const cnes = input.cnes?.trim();

  return request<CreatedProfessional>('/professionals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: input.accountId,
      specialism: input.specialism,
      councilNumber: input.councilNumber.trim(),
      councilState: input.councilState.toLowerCase(),
      ...(institution ? { institution } : {}),
      ...(cnes ? { cnes } : {}),
    }),
  });
}

export type CreatedProfessional = {
  id: string;
  accountId: string;
  name: string;
  email: string;
  specialism: { id: ProfessionalSpecialism; name: string };
  registration: ProfessionalRegistration;
  institution: string | null;
  cnes: string | null;
};
