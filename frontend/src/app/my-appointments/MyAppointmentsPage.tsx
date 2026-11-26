'use client';

import AppointmentsTable from '@/components/appointments/AppointmentsTable';
import AuthenticatedPage from '@/components/AuthenticatedPage';

// "Atendimentos" do paciente (`meus-atendimentos.html`, RFACT006): só os
// dele, e no modal só o plano, o motivo da falta e a assinatura (RN028).
export default function MyAppointmentsPage() {
  return (
    <AuthenticatedPage
      currentHref="/my-appointments"
      breadcrumb="Atendimentos"
      requiredAction="viewOwnCare"
    >
      {(account) =>
        account.patientProfileId ? (
          <>
            <div className="heading">
              <div>
                <h1>Atendimentos</h1>
              </div>
            </div>

            <AppointmentsTable
              id="my-appointments"
              title="Meus atendimentos"
              account={account}
              scope={{ patientId: account.patientProfileId }}
            />
          </>
        ) : (
          <p>Perfil de paciente não encontrado</p>
        )
      }
    </AuthenticatedPage>
  );
}
