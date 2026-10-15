'use client';

import AuthenticatedPage from '@/components/AuthenticatedPage';
import type { ProfileKind } from '@/lib/account';
import HomeContent from './HomeContent';

function getBreadcrumb(kind: ProfileKind) {
  if (kind === 'patient') {
    return 'Meu cuidado';
  }

  if (kind === 'waiting') {
    return 'Aguardando perfil';
  }

  return undefined;
}

export default function Inicio() {
  return (
    <AuthenticatedPage currentHref="/" breadcrumb={getBreadcrumb}>
      {(account, kind) => <HomeContent kind={kind} name={account.name} />}
    </AuthenticatedPage>
  );
}
