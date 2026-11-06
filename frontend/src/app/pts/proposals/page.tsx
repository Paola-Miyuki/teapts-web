'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import AuthenticatedPage from '@/components/AuthenticatedPage';
import HelpTooltip from '@/components/HelpTooltip';
import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import type { Account } from '@/lib/account';
import { can } from '@/lib/permissions';

import LoadingState from './_components/LoadingState';
import PtsProposalList from './_components/PtsProposalList';
import styles from './proposals.module.css';

function ProposalsContent({ account }: { account: Account }) {
  const searchParams = useSearchParams();

  const searchFromUrl = searchParams.get('search')?.trim() ?? '';
  const patientIdFromUrl = searchParams.get('patientId')?.trim() ?? '';

  return (
    <Suspense fallback={<LoadingState />}>
      <PtsProposalList
        key={`${patientIdFromUrl}:${searchFromUrl}`}
        account={account}
      />
    </Suspense>
  );
}

export default function PtsProposalsPage() {
  return (
    <AuthenticatedPage
      currentHref="/pts/proposals"
      breadcrumb="Propostas de PTS"
      requiredAction="viewPtsProposals"
    >
      {(account: Account) => (
        <>
          <div className={styles.header}>
            <div className={ui.heading}>
              <div>
                <div className={styles.titleRow}>
                  <h1>Propostas de PTS</h1>

                  <HelpTooltip
                    id="proposals-help"
                    label="Como funciona a escolha da proposta"
                  >
                    Só uma proposta pode ser aceita por vez. Quando uma é
                    aceita, as outras propostas pendentes são rejeitadas
                    automaticamente.
                  </HelpTooltip>
                </div>
                <p>
                  Conheça a equipe que vai planejar seu Programa Terapêutico
                  Singular.
                </p>
              </div>
            </div>

            {can(account, 'createPts') && (
              <Link
                href="/pts/novo"
                className={`${ui.btn} ${ui.btnPrimary} ${styles.headerAction}`}
              >
                <Icon name="plus" className={ui.icon} />
                Novo PTS
              </Link>
            )}
          </div>

          <Suspense fallback={<LoadingState />}>
            <ProposalsContent account={account} />
          </Suspense>
        </>
      )}
    </AuthenticatedPage>
  );
}
