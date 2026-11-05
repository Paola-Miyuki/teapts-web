'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

import { useAccount } from '@/hooks/useAccount';
import {
  getNavigation,
  getProfileKind,
  isPatientArea,
  ROLE_LABELS,
} from '@/lib/account';
import type { Account, ProfileKind } from '@/lib/account';
import { can, type PermissionAction } from '@/lib/permissions';
import AppShell from './AppShell';
import styles from './AppShell.module.css';
import ui from './ui.module.css';

type AuthenticatedPageProps = {
  currentHref: string;
  requiredAction?: PermissionAction;
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
  requiredAction,
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

  if (requiredAction && !can(account, requiredAction)) {
    return (
      <div className={styles.status} role="alert">
        <h1>Acesso restrito</h1>
        <p>Você não tem permissão para acessar esta área.</p>
        <Link href="/home" className={`${ui.btn} ${ui.btnSecondary}`}>
          Voltar para o início
        </Link>
      </div>
    );
  }

  return (
    <AppShell
      userName={account.name}
      roleLabel={ROLE_LABELS[kind]}
      navCaption={isPatientArea(kind) ? 'Meu cuidado' : 'Área de trabalho'}
      navItems={getNavigation(account, currentHref)}
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
