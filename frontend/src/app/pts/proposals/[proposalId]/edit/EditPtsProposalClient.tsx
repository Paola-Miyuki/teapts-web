'use client';

import AuthenticatedPage from '@/components/AuthenticatedPage';

import EditPtsProposalForm from './EditPtsProposalForm';

type EditPtsProposalClientProps = {
  proposalId: string;
};

export default function EditPtsProposalClient({
  proposalId,
}: EditPtsProposalClientProps) {
  return (
    <AuthenticatedPage
      currentHref="/pts/proposals"
      breadcrumb={[
        { label: 'PTS', href: '/pts/proposals' },
        { label: 'Editar proposta' },
      ]}
    >
      {(account) => (
        <EditPtsProposalForm proposalId={proposalId} account={account} />
      )}
    </AuthenticatedPage>
  );
}
