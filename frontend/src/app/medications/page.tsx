'use client';

import AuthenticatedPage from '@/components/AuthenticatedPage';

import PatientMedications from './_components/PatientMedications';

// "Medicações" de `minhas-medicacoes.html` (RFPAC007): o paciente consulta as
// próprias medicações, só para leitura.
export default function MedicationsPage() {
  return (
    <AuthenticatedPage
      currentHref="/medications"
      breadcrumb="Medicações"
      requiredAction="viewOwnCare"
    >
      {(account) =>
        account.patientProfileId ? (
          <>
            <div className="heading">
              <div>
                <h1>Medicações</h1>
              </div>
            </div>

            <PatientMedications patientId={account.patientProfileId} />
          </>
        ) : (
          <p>Perfil de paciente não encontrado</p>
        )
      }
    </AuthenticatedPage>
  );
}
