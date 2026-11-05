import type { IconName } from '@/components/Icon';
import { request } from '@/lib/api';
import { can, getProfileKind, type ProfileKind } from '@/lib/permissions';

export { getProfileKind, type ProfileKind } from '@/lib/permissions';

export type Account = {
  accountId: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  patientProfileId: string | null;
  professionalProfileIds: string[];
};

// GET /me: conta da sessão atual.
export function getMe() {
  return request<Account>('/me');
}

export type UpdateAccountInput = {
  name?: string;
  email?: string;
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
  waiting: 'Aguardando perfil',
};

const HOME_LABELS: Record<ProfileKind, string> = {
  admin: 'Início',
  professional: 'Início',
  patient: 'Meu cuidado',
  waiting: 'Início',
};

export function isPatientArea(kind: ProfileKind) {
  return kind === 'patient' || kind === 'waiting';
}

export function getNavigation(account: Account, currentHref: string) {
  const items: NavItem[] = [
    {
      href: '/home',
      icon: 'home',
      label: HOME_LABELS[getProfileKind(account)],
    },
  ];

  if (can(account, 'viewProfessionalDirectory')) {
    items.push({
      href: '/professionals',
      icon: 'people',
      label: 'Profissionais',
    });
  }

  if (can(account, 'viewPtsProposals')) {
    items.push({ href: '/pts/proposals', icon: 'clipboard', label: 'PTS' });
  }

  if (can(account, 'viewPatientRegistry')) {
    items.push({ href: '/patients', icon: 'patient', label: 'Pacientes' });
  }

  return items.map((item) => ({
    ...item,
    current: item.href === currentHref,
  }));
}
