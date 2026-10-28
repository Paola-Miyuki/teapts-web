'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import AuthenticatedPage from '@/components/AuthenticatedPage';
import ui from '@/components/ui.module.css';
import type { Account } from '@/lib/account';

import LoadingState from './_components/LoadingState';
import PtsProposalList from './_components/PtsProposalList';
import PtsProposalFilters, {
  type ProposalFilters,
} from './_components/PtsProposalFilters';
import styles from './proposals.module.css';

function ProposalsContent({ account }: { account: Account }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const searchFromUrl = searchParams.get('search')?.trim() ?? '';
  const patientIdFromUrl = searchParams.get('patientId')?.trim() ?? '';

  function updateUrl(search: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (search) {
      params.set('search', search);
    } else {
      params.delete('search');
    }

    const query = params.toString();
    router.push(query ? `/pts/proposals?${query}` : '/pts/proposals');
  }

  function handleApplyFilters(filters: ProposalFilters) {
    updateUrl(filters.search.trim());
  }

  function handleClearFilters() {
    updateUrl('');
  }

  return (
    <>
      <PtsProposalFilters
        key={searchFromUrl}
        filters={{ search: searchFromUrl }}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
      />

      <Suspense fallback={<LoadingState />}>
        <PtsProposalList
          key={`${patientIdFromUrl}:${searchFromUrl}`}
          account={account}
        />
      </Suspense>
    </>
  );
}

export default function PtsProposalsPage() {
  return (
    <AuthenticatedPage
      currentHref="/pts/proposals"
      breadcrumb="Propostas de PTS"
    >
      {(account: Account) => (
        <>
          <div className={styles.header}>
            <div className={ui.heading}>
              <div>
                <p className={ui.eyebrow}>Seu cuidado, sua escolha</p>
                <h1>Propostas de PTS</h1>
                <p>
                  Conheça a equipe que vai planejar seu Programa Terapêutico
                  Singular.
                </p>
              </div>
            </div>

            <Link
              href="/pts/novo"
              className={`${ui.btn} ${ui.btnPrimary} ${styles.headerAction}`}
            >
              Novo PTS
            </Link>
          </div>

          <div className={styles.notice}>
            <strong>Uma equipe por vez.</strong> Ao aceitar uma proposta, as
            outras propostas pendentes serão automaticamente rejeitadas.
          </div>

          <Suspense fallback={<LoadingState />}>
            <ProposalsContent account={account} />
          </Suspense>
        </>
      )}
    </AuthenticatedPage>
  );
}
