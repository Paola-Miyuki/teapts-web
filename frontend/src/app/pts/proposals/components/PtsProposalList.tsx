'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import styles from '../proposals.module.css';

import EmptyState from './EmptyState';
import ErrorState from './ErrorState';
import LoadingState from './LoadingState';
import Pagination from './Pagination';
import PtsProposalCard from './PtsProposalCard';

import type { PtsProposal } from './PtsProposalCard';

type CurrentAccount = {
  accountId: string;
  name: string;
  email: string;
  role: string;
  patientProfileId: string | null;
  professionalProfileIds: string[];
};

type PaginationData = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type ProposalsResponse = {
  data: PtsProposal[];
  pagination: PaginationData;
};

type ApiErrorResponse = {
  status?: string;
  message?: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

const PAGE_LIMIT = 20;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getApiMessage(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as ApiErrorResponse;

    if (typeof body.message === 'string' && body.message.trim()) {
      return body.message;
    }
  } catch {
    return fallback;
  }

  return fallback;
}

export default function PtsProposalList() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const patientIdFromUrl = searchParams.get('patientId')?.trim() ?? '';

  const [targetPatientId, setTargetPatientId] = useState<string | null>(null);

  const [contextMessage, setContextMessage] = useState('');

  const [accountLoading, setAccountLoading] = useState(true);

  const [accountError, setAccountError] = useState('');

  const [accountRetryKey, setAccountRetryKey] = useState(0);

  const [proposals, setProposals] = useState<PtsProposal[] | null>(null);

  const [proposalError, setProposalError] = useState('');

  const [proposalRetryKey, setProposalRetryKey] = useState(0);

  const [page, setPage] = useState(1);

  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: PAGE_LIMIT,
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_URL}/me`, {
      credentials: 'include',
    })
      .then(async (response) => {
        if (cancelled) {
          return;
        }

        if (response.status === 401) {
          router.replace('/login');
          return;
        }

        if (!response.ok) {
          const message = await getApiMessage(
            response,
            'Não foi possível identificar a conta autenticada.',
          );

          if (cancelled) {
            return;
          }

          setAccountError(message);
          setAccountLoading(false);
          return;
        }

        const account = (await response.json()) as CurrentAccount;

        if (cancelled) {
          return;
        }

        setAccountError('');
        setContextMessage('');
        setPage(1);
        setProposals(null);
        setProposalError('');

        if (patientIdFromUrl) {
          if (!UUID_PATTERN.test(patientIdFromUrl)) {
            setTargetPatientId(null);

            setContextMessage(
              'O identificador do paciente informado não é válido.',
            );

            setAccountLoading(false);
            return;
          }

          setTargetPatientId(patientIdFromUrl);
          setAccountLoading(false);
          return;
        }

        if (account.patientProfileId) {
          setTargetPatientId(account.patientProfileId);

          setAccountLoading(false);
          return;
        }

        if (account.professionalProfileIds?.length > 0) {
          setTargetPatientId(null);

          setContextMessage(
            'Para consultar as propostas, selecione um paciente em que você participa e acesse esta página novamente.',
          );

          setAccountLoading(false);
          return;
        }

        setTargetPatientId(null);

        setContextMessage(
          'Não foi possível identificar um perfil de paciente para consultar as propostas.',
        );

        setAccountLoading(false);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setAccountError('Não foi possível identificar a conta autenticada.');

        setAccountLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accountRetryKey, patientIdFromUrl, router]);

  useEffect(() => {
    if (!targetPatientId) {
      return;
    }

    let cancelled = false;

    const params = new URLSearchParams({
      patientId: targetPatientId,
      page: String(page),
      limit: String(PAGE_LIMIT),
    });

    fetch(`${API_URL}/pts/proposals?${params.toString()}`, {
      credentials: 'include',
    })
      .then(async (response) => {
        if (cancelled) {
          return;
        }

        if (response.status === 401) {
          router.replace('/login');
          return;
        }

        if (!response.ok) {
          const message = await getApiMessage(
            response,
            'Não foi possível consultar as propostas de PTS.',
          );

          if (cancelled) {
            return;
          }

          setProposals([]);
          setProposalError(message);
          return;
        }

        const result = (await response.json()) as ProposalsResponse;

        if (cancelled) {
          return;
        }

        setProposalError('');
        setProposals(result.data);
        setPagination(result.pagination);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setProposals([]);

        setProposalError('Não foi possível consultar as propostas de PTS.');
      });

    return () => {
      cancelled = true;
    };
  }, [page, proposalRetryKey, router, targetPatientId]);

  function handleAccountRetry() {
    setAccountLoading(true);
    setAccountError('');
    setContextMessage('');
    setTargetPatientId(null);
    setProposals(null);

    setAccountRetryKey((current) => current + 1);
  }

  function handleProposalRetry() {
    setProposals(null);
    setProposalError('');

    setProposalRetryKey((current) => current + 1);
  }

  function handlePageChange(newPage: number) {
    setProposals(null);
    setProposalError('');
    setPage(newPage);
  }

  if (accountLoading) {
    return <LoadingState />;
  }

  if (accountError) {
    return <ErrorState message={accountError} onRetry={handleAccountRetry} />;
  }

  if (!targetPatientId) {
    return (
      <EmptyState
        title={patientIdFromUrl ? 'Paciente inválido' : 'Selecione um paciente'}
        message={contextMessage}
      />
    );
  }

  if (proposals === null) {
    return <LoadingState />;
  }

  if (proposalError) {
    return <ErrorState message={proposalError} onRetry={handleProposalRetry} />;
  }

  if (proposals.length === 0) {
    return (
      <EmptyState
        title="Nenhuma proposta encontrada"
        message="Não existem propostas de PTS pendentes para este paciente."
      />
    );
  }

  return (
    <div className={styles.proposalsArea}>
      <div className={styles.listHeader}>
        <div>
          <h2>Propostas disponíveis</h2>

          <p>
            {pagination.total}{' '}
            {pagination.total === 1
              ? 'proposta encontrada'
              : 'propostas encontradas'}
          </p>
        </div>
      </div>

      <div className={styles.proposalList}>
        {proposals.map((proposal) => (
          <PtsProposalCard key={proposal.id} proposal={proposal} />
        ))}
      </div>

      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
