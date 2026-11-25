import type { IconName } from '@/components/Icon';
import { request } from '@/lib/api';
import { can, type ProfileKind } from '@/lib/permissions';

export { getProfileKind, type ProfileKind } from '@/lib/permissions';

export type Sex = 'male' | 'female';

export type Gender =
  | 'cis_woman'
  | 'trans_woman'
  | 'cis_man'
  | 'trans_man'
  | 'non_binary'
  | 'other'
  | 'prefer_not_to_say';

export const SEX_LABELS: Record<Sex, string> = {
  female: 'Feminino',
  male: 'Masculino',
};

export const GENDER_LABELS: Record<Gender, string> = {
  cis_woman: 'Mulher cisgênero',
  trans_woman: 'Mulher transgênero',
  cis_man: 'Homem cisgênero',
  trans_man: 'Homem transgênero',
  non_binary: 'Pessoa não binária',
  other: 'Outro',
  prefer_not_to_say: 'Prefiro não informar',
};

// Campos pessoais nulos só na conta de admin e nas contas antigas; CPF e
// telefone vêm só com dígitos.
export type Account = {
  accountId: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  socialName: string | null;
  birthDate: string | null;
  sex: Sex | null;
  gender: Gender | null;
  cpf: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string | null;
  patientProfileId: string | null;
  professionalProfileIds: string[];
};

// GET /me: conta da sessão atual.
export function getMe() {
  return request<Account>('/me');
}

// null apaga o campo opcional (nome social, gênero, telefone).
export type UpdateAccountInput = {
  name?: string;
  email?: string;
  socialName?: string | null;
  birthDate?: string;
  sex?: Sex;
  gender?: Gender | null;
  phone?: string | null;
};

// PATCH /me: atualiza somente os campos informados da conta atual.
export function updateMe(input: UpdateAccountInput) {
  return request<Account>('/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

// POST /me/password: troca a senha pelo provedor de autenticação.
export function changePassword(input: ChangePasswordInput) {
  return request<{ status: 'OK' }>('/me/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export type DeleteAccountResponse = {
  id: string;
  status: string;
  deactivatedAt: string;
};

// DELETE /me: desativa a conta da sessão atual e encerra as sessões (RFAUT005).
export function deleteMe() {
  return request<DeleteAccountResponse>('/me', { method: 'DELETE' });
}

export type NavItem = {
  href: string;
  icon: IconName;
  label: string;
  current?: boolean;
};

export const ROLE_LABELS: Record<ProfileKind, string> = {
  admin: 'Administrador',
  professional: 'Profissional',
  patient: 'Paciente',
  waiting: 'Aguardando aprovação',
};

export function isPatientArea(kind: ProfileKind) {
  return kind === 'patient' || kind === 'waiting';
}

export function getNavigation(account: Account, currentHref: string) {
  const items: NavItem[] = [
    {
      href: '/home',
      icon: 'home',
      label: 'Início',
    },
  ];

  if (can(account, 'manageAccounts')) {
    items.push({ href: '/accounts', icon: 'accounts', label: 'Contas' });
  }

  if (can(account, 'viewProfessionalDirectory')) {
    items.push({
      href: '/professionals',
      icon: 'people',
      label: 'Profissionais',
    });
  }

  // RFPTS004 – o paciente vê o próprio PTS ativo; o profissional chega a
  // ele pela rota do paciente (/patients/[id]/pts).
  if (can(account, 'viewOwnCare') && can(account, 'viewActivePts')) {
    items.push({ href: '/pts', icon: 'check', label: 'Meu PTS' });
  }

  if (can(account, 'viewOwnCare')) {
    items.push({
      href: '/medications',
      icon: 'pill',
      label: 'Medicações',
    });
  }

  if (can(account, 'viewPtsProposals')) {
    items.push({
      href: '/pts/proposals',
      icon: 'clipboard',
      label: account.patientProfileId !== null ? 'Propostas de PTS' : 'PTS',
    });
  }

  if (can(account, 'viewAuthorizedPatients')) {
    items.push({ href: '/patients', icon: 'patient', label: 'Pacientes' });
  }

  return items.map((item) => ({
    ...item,
    current: item.href === currentHref,
  }));
}
