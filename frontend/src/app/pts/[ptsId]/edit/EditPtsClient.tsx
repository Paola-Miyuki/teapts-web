'use client';

import AuthenticatedPage from '@/components/AuthenticatedPage';

import EditPtsSheetForm from './EditPtsSheetForm';

export default function EditPtsClient({ ptsId }: { ptsId: string }) {
  return (
    <AuthenticatedPage
      currentHref="/pts/proposals"
      breadcrumb={[
        { label: 'PTS', href: '/pts/proposals' },
        { label: 'Detalhe do PTS', href: `/pts/${ptsId}` },
        { label: 'Editar PTS' },
      ]}
      requiredAction="viewPts"
    >
      {(account) => <EditPtsSheetForm ptsId={ptsId} account={account} />}
    </AuthenticatedPage>
  );
}
