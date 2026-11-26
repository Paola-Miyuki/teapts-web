'use client';

import AuthenticatedPage from '@/components/AuthenticatedPage';

import ReassessmentPage from './ReassessmentPage';

export default function ReassessmentClient({ ptsId }: { ptsId: string }) {
  return (
    <AuthenticatedPage
      currentHref="/pts/proposals"
      breadcrumb={[
        { label: 'PTS', href: '/pts/proposals' },
        { label: 'Detalhe do PTS', href: `/pts/${ptsId}` },
        { label: 'Reavaliação' },
      ]}
      requiredAction="viewPts"
    >
      {(account) => <ReassessmentPage ptsId={ptsId} account={account} />}
    </AuthenticatedPage>
  );
}
