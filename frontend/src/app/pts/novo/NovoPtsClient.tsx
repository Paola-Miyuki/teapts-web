'use client';

import AuthenticatedPage from '@/components/AuthenticatedPage';
import { CreatePts } from './CreatePts';

export default function NovoPtsClient() {
  return (
    <AuthenticatedPage
      currentHref="/pts/novo"
      breadcrumb="Criar proposta de PTS"
    >
      {(account) => <CreatePts account={account} />}
    </AuthenticatedPage>
  );
}
