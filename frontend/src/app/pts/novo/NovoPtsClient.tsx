'use client';

import AuthenticatedPage from '@/components/AuthenticatedPage';
import CreatePts from './CreatePts';

export default function NovoPtsClient() {
  return (
    <AuthenticatedPage
      currentHref="/pts/proposals"
      breadcrumb="Criar proposta de PTS"
      requiredAction="createPts"
    >
      {(account) => <CreatePts account={account} />}
    </AuthenticatedPage>
  );
}
