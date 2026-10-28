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

// GET /accounts: 1ª página das contas sem perfil de paciente (só admin).
export function getAccountsWithoutPatientProfile() {
  return request<AccountsResponse>('/accounts?isPatient=false&page=1&limit=20');
}

// GET /accounts: contas com perfil de paciente, paginadas (só admin).
export function getPatientAccounts(page: number, limit: number) {
  return request<AccountsResponse>(
    `/accounts?isPatient=true&page=${page}&limit=${limit}`,
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
