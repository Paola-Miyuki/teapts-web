import { Suspense } from 'react';

import AuthenticatedPage from '@/components/AuthenticatedPage';

import LoadingState from './components/LoadingState';
import PtsProposalList from './components/PtsProposalList';

import styles from './proposals.module.css';

export default function PtsProposalsPage() {
  return (
    <AuthenticatedPage
      currentHref="/pts/proposals"
      breadcrumb="Propostas de PTS"
    >
      <div className={styles.section}>
        <div className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>Seu cuidado, sua escolha</p>

            <h1>Propostas de PTS</h1>

            <p className={styles.description}>
              Conheça a equipe que vai planejar seu Programa Terapêutico
              Singular.
            </p>
          </div>
        </div>

        <div className={styles.notice}>
          <strong>Uma equipe por vez.</strong> Ao aceitar uma proposta, as
          outras propostas pendentes serão automaticamente rejeitadas.
        </div>

        <Suspense fallback={<LoadingState />}>
          <PtsProposalList />
        </Suspense>
      </div>

      <footer className={styles.footer}>
        <span>TEA-PTS · Programa Terapêutico Singular</span>
        <span>Propostas disponíveis no sistema</span>
      </footer>
    </AuthenticatedPage>
  );
}
