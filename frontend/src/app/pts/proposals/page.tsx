'use client';

import { Suspense, useState } from 'react';
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
import ProposalDecisionDialog from './_components/ProposalDecisionDialog';
import styles from './proposals.module.css';
import { getProfileKind } from '@/lib/account';

function ProposalsContent({ account }: { account: Account }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const searchFromUrl = searchParams.get('search')?.trim() ?? '';
  const patientIdFromUrl = searchParams.get('patientId')?.trim() ?? '';

  // Novos estados para a issue RFPTS003
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(
    null,
  );
  const [dialogType, setDialogType] = useState<'approve' | 'reject' | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

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

  // Funções de controle do modal e da API
  const handleOpenModal = (proposalId: string, type: 'approve' | 'reject') => {
    setSelectedProposalId(proposalId);
    setDialogType(type);
    setErrorMessage(null);
  };

  const handleCloseModal = () => {
    if (isLoading) return;
    setSelectedProposalId(null);
    setDialogType(null);
    setErrorMessage(null);
  };

  const handleConfirmDecision = async () => {
    if (!selectedProposalId || !dialogType) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const endpoint = `/pts/proposals/${selectedProposalId}/${dialogType}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (response.status === 401) {
        router.push('/login');
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao processar solicitação.');
      }

      if (dialogType === 'approve') {
        router.push('/pts');
      } else {
        setFeedbackMessage('Proposta rejeitada.');
        handleCloseModal();
        router.refresh();
      }
    } catch (err: unknown) {
      const errorObj = err as Error;
      setErrorMessage(errorObj.message || 'Erro de comunicação.');
    }
  };

  const isPatient = getProfileKind(account) === 'patient';

  return (
    <>
      <PtsProposalFilters
        key={searchFromUrl}
        filters={{ search: searchFromUrl }}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
      />

      {feedbackMessage && (
        <div className="mb-4 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700 border border-emerald-200">
          {feedbackMessage}
        </div>
      )}

      <Suspense fallback={<LoadingState />}>
        <PtsProposalList
          key={`${patientIdFromUrl}:${searchFromUrl}`}
          account={account}
          isPatient={isPatient}
          onOpenDecisionModal={handleOpenModal}
        />
      </Suspense>

      <ProposalDecisionDialog
        isOpen={!!dialogType}
        type={dialogType}
        isLoading={isLoading}
        errorMessage={errorMessage}
        onConfirm={handleConfirmDecision}
        onCancel={handleCloseModal}
      />
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
