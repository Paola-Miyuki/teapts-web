import type { IconName } from '@/components/Icon';

export type Account = {
  accountId: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  patientProfileId: string | null;
  professionalProfileIds: string[];
};

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
    items = [{ href: '/', icon: 'home', label: 'Início' }];
  } else if (kind === 'patient') {
    items = [{ href: '/', icon: 'home', label: 'Meu cuidado' }];
  } else {
    items = [
      { href: '/', icon: 'home', label: 'Início' },
      { href: '/profissionais', icon: 'people', label: 'Profissionais' },
    ];
  }

  return items.map((item) => ({
    ...item,
    current: item.href === currentHref,
  }));
}
