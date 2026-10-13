'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import styles from '../inicio.module.css';
import AppShell from './AppShell';
import type { NavItem } from './AppShell';
import HomeContent from './HomeContent';

export type Account = {
  accountId: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  patientProfileId: string | null;
  professionalProfileIds: string[];
};

export type ProfileKind = 'admin' | 'professional' | 'patient' | 'waiting';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

const ROLE_LABELS: Record<ProfileKind, string> = {
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

function getNavigation(kind: ProfileKind): NavItem[] {
  if (kind === 'waiting') {
    return [{ href: '/', icon: 'home', label: 'Início', current: true }];
  }

  if (kind === 'patient') {
    return [{ href: '/', icon: 'home', label: 'Meu cuidado', current: true }];
  }

  return [
    { href: '/', icon: 'home', label: 'Início', current: true },
    { href: '/profissionais', icon: 'people', label: 'Profissionais' },
  ];
}

export default function Inicio() {
  const router = useRouter();

  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_URL}/me`, { credentials: 'include' })
      .then(async (response) => {
        if (cancelled) {
          return;
        }

        if (response.status === 401) {
          router.replace('/login');
          return;
        }

        if (!response.ok) {
          setError('Não foi possível carregar os dados da sua conta.');
          return;
        }

        const result = (await response.json()) as Account;

        if (!cancelled) {
          setAccount(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Não foi possível carregar os dados da sua conta.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [retryKey, router]);

  function handleRetry() {
    setError('');
    setRetryKey((current) => current + 1);
  }

  if (error) {
    return (
      <div className={styles.status} role="alert">
        <h1>Algo não saiu como esperado</h1>

        <p>{error}</p>

        <button
          type="button"
          className={`${styles.btn} ${styles.btnSecondary}`}
          onClick={handleRetry}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!account) {
    return (
      <div className={styles.status} role="status">
        <p>Carregando sua conta...</p>
      </div>
    );
  }

  const kind = getProfileKind(account);
  const isPatientArea = kind === 'patient' || kind === 'waiting';

  return (
    <AppShell
      userName={account.name}
      roleLabel={ROLE_LABELS[kind]}
      navCaption={isPatientArea ? 'Meu cuidado' : 'Área de trabalho'}
      navItems={getNavigation(kind)}
      breadcrumb={
        kind === 'patient'
          ? 'Meu cuidado'
          : kind === 'waiting'
            ? 'Aguardando perfil'
            : undefined
      }
    >
      <HomeContent kind={kind} name={account.name} />
    </AppShell>
  );
}
