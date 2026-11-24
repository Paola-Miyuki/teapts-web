import type { Account } from '@/lib/account';

// Dados pessoais da conta nos testes que não dependem deles.
export const personalData: Pick<
  Account,
  | 'socialName'
  | 'birthDate'
  | 'sex'
  | 'gender'
  | 'cpf'
  | 'phone'
  | 'createdAt'
  | 'updatedAt'
> = {
  socialName: null,
  birthDate: '1990-05-20',
  sex: 'female',
  gender: null,
  cpf: '52998224725',
  phone: null,
  createdAt: '2026-11-14T12:00:00.000Z',
  updatedAt: null,
};
