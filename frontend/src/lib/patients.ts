import { request } from '@/lib/api';
import type { PaginationData } from '@/lib/professionals';

export type AccountOption = {
  id: string;
  name: string;
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

export type CreatePatientBody = {
  accountId: string;
  supportContacts: SupportContact[];
};

export type PatientProfile = CreatePatientBody;

// GET /accounts: 1ª página das contas sem perfil de paciente (só admin).
export function getAccountsWithoutPatientProfile() {
  return request<AccountsResponse>('/accounts?isPatient=false&page=1&limit=20');
}

// POST /patients: cria o perfil de paciente da conta (só admin).
export function createPatient(body: CreatePatientBody) {
  return request<PatientProfile>('/patients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
