'use client';

import AuthenticatedPage from '@/components/AuthenticatedPage';

import MedicationsTable from '@/components/medications/MedicationsTable';

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

            <MedicationsTable patientId={account.patientProfileId} />
          </>
        ) : (
          <p>Perfil de paciente não encontrado</p>
        )
      }
    </AuthenticatedPage>
  );
}
