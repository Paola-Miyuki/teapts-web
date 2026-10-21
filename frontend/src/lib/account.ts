import type { IconName } from '@/components/Icon';
import { request } from '@/lib/api';

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

export type ProfileKind = 'admin' | 'professional' | 'patient' | 'waiting';

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

export function getProfileKind(account: Account): ProfileKind {
  if (account.role === 'admin') {
    return 'admin';
  }

  if (account.professionalProfileIds.length > 0) {
    return 'professional';
  }

  if (account.patientProfileId) {
    return 'patient';
  }

  return 'waiting';
}

export function isPatientArea(kind: ProfileKind) {
  return kind === 'patient' || kind === 'waiting';
}

export function getNavigation(kind: ProfileKind, currentHref: string) {
  let items: NavItem[];

  if (kind === 'waiting') {
    items = [{ href: '/home', icon: 'home', label: 'Início' }];
  } else if (kind === 'patient') {
    items = [
      { href: '/home', icon: 'home', label: 'Meu cuidado' },
      {
        href: '/pts/proposals',
        icon: 'home',
        label: 'Propostas de PTS',
      },
    ];
  } else {
    items = [
      { href: '/home', icon: 'home', label: 'Início' },
      { href: '/professionals', icon: 'people', label: 'Profissionais' },
      {
        href: '/pts/novo',
        icon: 'home',
        label: 'Criar proposta de PTS',
      },
    ];
  }

  return items.map((item) => ({
    ...item,
    current: item.href === currentHref,
  }));
}
