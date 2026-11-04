import type { IconName } from '@/components/Icon';
import { request } from '@/lib/api';
import { can, getProfileKind } from '@/lib/permissions';
import type { PermissionAction, PermissionUser, ProfileKind } from '@/lib/permissions';
export type { ProfileKind } from '@/lib/permissions';
export { getProfileKind } from '@/lib/permissions';

export type Account = {
  accountId: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  patientProfileId: string | null;
  professionalProfileIds: string[];
};

export type AccountPermissionUser = PermissionUser;

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
  action: PermissionAction;
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
  const kind = getProfileKind(account);
  const items: NavItem[] = [
    {
      href: '/home',
      icon: 'home',
      action: 'viewHome',
      label: HOME_LABELS[kind],
    },
  ];

  if (can(account, 'viewProfessionalDirectory')) {
    items.push({
      href: '/professionals',
      icon: 'people',
      label: 'Profissionais',
      action: 'viewProfessionalDirectory',
    });
  }

  if (can(account, 'viewPtsProposals')) {
    items.push({
      href: '/pts/proposals',
      icon: 'clipboard',
      label: 'PTS',
      action: 'viewPtsProposals',
    });
  }

  if (can(account, 'viewPatientRegistry')) {
    items.push({
      href: '/patients',
      icon: 'patient',
      label: 'Pacientes',
      action: 'viewPatientRegistry',
    });
  }

  const visibleItems = items.filter((item) =>
    can(account, item.action, { profileKind: kind }),
  );

  return visibleItems.map((item) => ({
    ...item,
    current: item.href === currentHref,
  }));
}
