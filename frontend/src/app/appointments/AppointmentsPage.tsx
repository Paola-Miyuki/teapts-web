'use client';

import Link from 'next/link';

import AppointmentsTable from '@/components/appointments/AppointmentsTable';
import AuthenticatedPage from '@/components/AuthenticatedPage';
import Icon from '@/components/Icon';
import { can } from '@/lib/permissions';

// "Atendimentos" da equipe (`atendimentos.html`, RFACT006): o admin vê
// todos; o profissional, os dos PTS da equipe (a API filtra, RN016).
export default function AppointmentsPage() {
  return (
    <AuthenticatedPage
      currentHref="/appointments"
      breadcrumb="Atendimentos"
      requiredAction="viewAppointments"
    >
      {(account) => (
        <>
          <div className="heading">
            <div>
              <h1>Atendimentos</h1>
            </div>
            {can(account, 'registerAppointment') && (
              <div className="heading-actions">
                <Link className="btn btn-primary" href="/appointments/new">
                  <Icon name="plus" className="icon-sm" />
                  Registrar atendimento
                </Link>
              </div>
            )}
          </div>

          <AppointmentsTable
            id="appointments"
            title="Atendimentos"
            account={account}
            showPatient
          />
        </>
      )}
    </AuthenticatedPage>
  );
}
