'use client';

import AuthenticatedPage from '@/components/AuthenticatedPage';
import UploadDocument from '@/app/patients/_components/UploadDocument';

// "Enviar documento" (RFDOC001, `enviar-documento.html`): admin, profissional
// com PTS ativo do paciente e o próprio paciente.
export default function UploadDocumentPage({
  patientId,
}: {
  patientId: string;
}) {
  return (
    <AuthenticatedPage
      currentHref={(kind) => (kind === 'patient' ? '/home' : '/patients')}
      breadcrumb={(kind) =>
        kind === 'patient'
          ? [{ label: 'Enviar documento' }]
          : [
              { label: 'Pacientes', href: '/patients' },
              { label: 'Paciente', href: `/patients/${patientId}` },
              { label: 'Enviar documento' },
            ]
      }
    >
      {(account) => (
        <>
          <div className="heading">
            <div>
              <h1>Enviar documento</h1>
            </div>
          </div>

          <UploadDocument account={account} patientId={patientId} />
        </>
      )}
    </AuthenticatedPage>
  );
}
