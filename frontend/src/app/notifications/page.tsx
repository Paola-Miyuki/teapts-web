'use client';

import AuthenticatedPage from '@/components/AuthenticatedPage';

import Notifications from './_components/Notifications';

export default function NotificationsPage() {
  return (
    <AuthenticatedPage currentHref="/notifications" breadcrumb="Notificações">
      {(_account, kind) => (
        <>
          <div className="heading">
            <div>
              <h1>Notificações</h1>
            </div>
          </div>

          {kind === 'admin' ? (
            <section className="ux-card ux-empty-card">
              <h2>O administrador não recebe notificações</h2>
            </section>
          ) : (
            <Notifications isPatient={kind === 'patient'} />
          )}
        </>
      )}
    </AuthenticatedPage>
  );
}
