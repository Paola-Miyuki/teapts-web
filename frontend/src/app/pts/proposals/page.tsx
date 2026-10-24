import { Suspense } from 'react';
import Link from 'next/link';
import AuthenticatedPage from '@/components/AuthenticatedPage';
import ui from '@/components/ui.module.css';
import LoadingState from './_components/LoadingState';
import PtsProposalList from './_components/PtsProposalList';
import styles from './proposals.module.css';

export default function PtsProposalsPage() {
  return (
    <AuthenticatedPage
      currentHref="/pts/proposals"
      breadcrumb="Propostas de PTS"
    >
      <div className={ui.heading}>
        <div>
          <p className={ui.eyebrow}>Seu cuidado, sua escolha</p>
          <h1>Propostas de PTS</h1>
          <p>Conheça a equipe que vai planejar seu Programa Terapêutico Singular.</p>
        </div>
        
        <Link href="/pts/novo" className={`${ui.btn} ${ui.btnPrimary}`}>
          Novo PTS
        </Link>
      </div>

      <div className={styles.notice}>
        <strong>Uma equipe por vez.</strong> Ao aceitar uma proposta, as
        outras propostas pendentes serão automaticamente rejeitadas.
      </div>

      <Suspense fallback={<LoadingState />}>
        <PtsProposalList />
      </Suspense>
    </AuthenticatedPage>
  );
}