'use client';

import AuthenticatedPage from '@/components/AuthenticatedPage';
import MedicationsCard from '@/app/patients/_components/MedicationsCard';

export default function MedicationsPage() {
  return (
    <AuthenticatedPage
      currentHref="/medications"
      breadcrumb="Minhas medicações"
      requiredAction="viewOwnCare"
    >
      {(account) =>
        account.patientProfileId ? (
          <MedicationsCard
            patientId={account.patientProfileId}
            canEdit={false}
          />
        ) : (
          <p>Perfil de paciente não encontrado</p>
        )
      }
    </AuthenticatedPage>
  );
}
