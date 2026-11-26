'use client';

import AuthenticatedPage from '@/components/AuthenticatedPage';
import CreatePts from './CreatePts';

export default function NovoPtsClient() {
  return (
    <AuthenticatedPage
      currentHref="/pts/proposals"
      breadcrumb={[
        { label: 'PTS', href: '/pts/proposals' },
        { label: 'Criar proposta' },
      ]}
      requiredAction="createPts"
    >
      {(account) => <CreatePts account={account} />}
    </AuthenticatedPage>
  );
}
