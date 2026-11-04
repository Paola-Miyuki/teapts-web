'use client';

import type { ReactNode } from 'react';

import { useAccount } from '@/hooks/useAccount';
import { getNavigation, getProfileKind, ROLE_LABELS } from '@/lib/account';
import type { Account, ProfileKind } from '@/lib/account';
import AppShell from './AppShell';
import styles from './AppShell.module.css';
import ui from './ui.module.css';

type AuthenticatedPageProps = {
  currentHref: string;
  breadcrumb?: string | ((kind: ProfileKind) => string | undefined);
  children:
    | ReactNode
    | ((
        account: Account,
        kind: ProfileKind,
        updateAccount: (account: Account) => void,
      ) => ReactNode);
};

// Carrega a conta e envolve a página na estrutura padrão (barra lateral e cabeçalho).
export default function AuthenticatedPage({
  currentHref,
  breadcrumb,
  children,
}: AuthenticatedPageProps) {
  const { account, error, retry, updateAccount } = useAccount();

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
        <span className={styles.loader} aria-hidden="true" />
        <p>Carregando sua conta...</p>
      </div>
    );
  }

  const kind = getProfileKind(account);

  return (
    <AppShell
      userName={account.name}
      roleLabel={ROLE_LABELS[kind]}
      navItems={getNavigation(kind, currentHref)}
      currentHref={currentHref}
      breadcrumb={
        typeof breadcrumb === 'function' ? breadcrumb(kind) : breadcrumb
      }
    >
      {typeof children === 'function'
        ? children(account, kind, updateAccount)
        : children}
    </AppShell>
  );
}
