'use client';

import AuthenticatedPage from '@/components/AuthenticatedPage';

import RegisterAppointmentPage from './RegisterAppointmentPage';

export default function RegisterAppointmentClient({
  ptsId,
  activityId,
}: {
  ptsId?: string;
  activityId?: string;
}) {
  return (
    <AuthenticatedPage
      currentHref="/pts/proposals"
      breadcrumb={[
        { label: 'PTS', href: '/pts/proposals' },
        ...(ptsId ? [{ label: 'Detalhe do PTS', href: `/pts/${ptsId}` }] : []),
        { label: 'Registrar atendimento' },
      ]}
      requiredAction="registerAppointment"
    >
      {(account) => (
        <RegisterAppointmentPage
          account={account}
          ptsId={ptsId}
          activityId={activityId}
        />
      )}
    </AuthenticatedPage>
  );
}
