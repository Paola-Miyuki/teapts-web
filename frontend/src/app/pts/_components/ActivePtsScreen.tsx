'use client';

import AuthenticatedPage from '@/components/AuthenticatedPage';
import ui from '@/components/ui.module.css';

import styles from '../pts.module.css';
import PtsOverview from './PtsOverview';

type ActivePtsScreenProps = {
  currentHref: string;
  // Rota do profissional; sem ele, vale o perfil de paciente da conta.
  routePatientId?: string;
};

export default function ActivePtsScreen({
  currentHref,
  routePatientId,
}: ActivePtsScreenProps) {
  return (
    <AuthenticatedPage
      currentHref={currentHref}
      breadcrumb="Programa Terapêutico Singular"
    >
      {(account) => {
        const patientId = routePatientId ?? account.patientProfileId;

        return (
          <>
            <div className={`${ui.heading} ${styles.header}`}>
              <div>
                <p className={ui.eyebrow}>Acompanhamento</p>
                <h1>Programa Terapêutico Singular</h1>
                <p>
                  Uma visão compartilhada das atividades, da equipe e dos
                  documentos.
                </p>
              </div>
            </div>

            <PtsOverview
              key={patientId ?? 'none'}
              account={account}
              patientId={patientId}
            />
          </>
        );
      }}
    </AuthenticatedPage>
  );
}
