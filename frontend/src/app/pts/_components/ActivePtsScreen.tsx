'use client';

import { useEffect, useState } from 'react';

import AuthenticatedPage from '@/components/AuthenticatedPage';
import PtsHistoryTab from '@/components/pts/PtsHistoryTab';
import PatientProposals from '@/app/pts/proposals/_components/PatientProposals';
import ui from '@/components/ui.module.css';
import type { Account } from '@/lib/account';

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
        const isOwnPts =
          account.patientProfileId !== null &&
          account.patientProfileId === patientId;

        return isOwnPts ? (
          <PatientPtsTabs account={account} patientId={patientId} />
        ) : (
          <PtsOverview
            key={patientId ?? 'none'}
            account={account}
            patientId={patientId}
          />
        );
      }}
    </AuthenticatedPage>
  );
}

function PatientPtsTabs({
  account,
  patientId,
}: {
  account: Account;
  patientId: string | null;
}) {
  const [activeTab, setActiveTab] = useState<
    'atual' | 'propostas' | 'historico'
  >('atual');

  // Links de fora (ex.: "Ver propostas de PTS") abrem a aba por `/pts#propostas`.
  useEffect(() => {
    const openFromHash = () => {
      if (window.location.hash === '#propostas') {
        setActiveTab('propostas');
      }
    };

    openFromHash();
    window.addEventListener('hashchange', openFromHash);

    return () => window.removeEventListener('hashchange', openFromHash);
  }, []);

  return (
    <>
      <div className={`${ui.heading} ${styles.header}`}>
        <div>
          <p className={ui.eyebrow}>Acompanhamento</p>
          <h1>Programa Terapêutico Singular</h1>
          <p>
            Uma visão compartilhada das atividades, da equipe e dos documentos.
          </p>
        </div>
      </div>

      <nav className="tabs ux-ptabs" aria-label="Seções do PTS">
        <a
          href="#atual"
          aria-current={activeTab === 'atual' ? 'page' : undefined}
          onClick={(event) => {
            event.preventDefault();
            setActiveTab('atual');
          }}
        >
          Meu PTS
        </a>
        <a
          href="#propostas"
          aria-current={activeTab === 'propostas' ? 'page' : undefined}
          onClick={(event) => {
            event.preventDefault();
            setActiveTab('propostas');
          }}
        >
          Propostas de PTS
        </a>
        <a
          href="#historico-pts"
          aria-current={activeTab === 'historico' ? 'page' : undefined}
          onClick={(event) => {
            event.preventDefault();
            setActiveTab('historico');
          }}
        >
          Histórico de PTS
        </a>
      </nav>

      {activeTab === 'atual' ? (
        <PtsOverview
          key={patientId ?? 'none'}
          account={account}
          patientId={patientId}
        />
      ) : activeTab === 'propostas' ? (
        <PatientProposals />
      ) : patientId ? (
        <PtsHistoryTab patientId={patientId} />
      ) : null}
    </>
  );
}
