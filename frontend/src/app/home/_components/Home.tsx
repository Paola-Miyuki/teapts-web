'use client';

import AuthenticatedPage from '@/components/AuthenticatedPage';
import type { ProfileKind } from '@/lib/account';
import HomeContent from './HomeContent';

function getBreadcrumb(kind: ProfileKind) {
  return {
    admin: undefined,
    professional: undefined,
    patient: 'Meu cuidado',
    waiting: 'Aguardando perfil',
  }[kind];
}

export default function Home() {
  return (
    <AuthenticatedPage currentHref="/home" breadcrumb={getBreadcrumb}>
      {(account, kind) => (
        <HomeContent account={account} kind={kind} name={account.name} />
      )}
    </AuthenticatedPage>
  );
}
