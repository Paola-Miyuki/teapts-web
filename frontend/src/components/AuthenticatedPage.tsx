'use client';

import type { ReactNode } from 'react';

import { useAccount } from '@/hooks/useAccount';
import {
  getNavigation,
  getProfileKind,
  isPatientArea,
  ROLE_LABELS,
} from '@/lib/account';
import type { Account, ProfileKind } from '@/lib/account';
import AppShell from './AppShell';
import styles from './AppShell.module.css';
import ui from './ui.module.css';

type AuthenticatedPageProps = {
  currentHref: string;
  breadcrumb?: string | ((kind: ProfileKind) => string | undefined);
  children: ReactNode | ((account: Account, kind: ProfileKind) => ReactNode);
};

// Carrega a conta e envolve a página na estrutura padrão (barra lateral e cabeçalho).
export default function AuthenticatedPage({
  currentHref,
  breadcrumb,
  children,
}: AuthenticatedPageProps) {
  const { account, error, retry } = useAccount();

  if (error) {
    return (
      <div className={styles.status} role="alert">
        <h1>Algo não saiu como esperado</h1>

        <p>{error}</p>

        <button
          type="button"
          className={`${ui.btn} ${ui.btnSecondary}`}
          onClick={retry}
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

  return (
    <AppShell
      userName={account.name}
      roleLabel={ROLE_LABELS[kind]}
      navCaption={isPatientArea(kind) ? 'Meu cuidado' : 'Área de trabalho'}
      navItems={getNavigation(kind, currentHref)}
      breadcrumb={
        typeof breadcrumb === 'function' ? breadcrumb(kind) : breadcrumb
      }
    >
      {typeof children === 'function' ? children(account, kind) : children}
    </AppShell>
  );
}
