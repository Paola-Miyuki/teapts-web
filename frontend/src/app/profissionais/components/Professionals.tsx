'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import styles from '../profissionais.module.css';
import EmptyState from './EmptyState';
import LoadingState from './LoadingState';
import Pagination from './Pagination';
import ProfessionalFilters from './ProfessionalFilters';
import ProfessionalList from './ProfessionalList';

export type ProfessionalSpecialism =
  'psychologist' | 'doctor' | 'physiotherapist';

export type Professional = {
  id: string;
  name: string;
  email: string;
  specialism: {
    id: ProfessionalSpecialism;
    name: string;
  };
};

type PaginationData = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type ProfessionalsResponse = {
  data: Professional[];
  pagination: PaginationData;
};

export type Filters = {
  name: string;
  specialism: ProfessionalSpecialism | '';
  ids: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

const PAGE_LIMIT = 10;

const EMPTY_FILTERS: Filters = {
  name: '',
  specialism: '',
  ids: '',
};

export default function Professionals() {
  const router = useRouter();

  const [professionals, setProfessionals] = useState<Professional[] | null>(
    null,
  );

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [retryKey, setRetryKey] = useState(0);
  const [error, setError] = useState('');

  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: PAGE_LIMIT,
    total: 0,
    totalPages: 1,
  });

  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_LIMIT),
    });

    const name = filters.name.trim();

    if (name) {
      params.set('name', name);
    }

    if (filters.specialism) {
      params.set('specialism', filters.specialism);
    }

    const ids = filters.ids
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    if (ids.length > 0) {
      params.set('ids', [...new Set(ids)].join(','));
    }

    fetch(`${API_URL}/professionals?${params.toString()}`, {
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
          setProfessionals([]);
          setError('Não foi possível consultar os profissionais.');
          return;
        }

        const result = (await response.json()) as ProfessionalsResponse;

        if (cancelled) {
          return;
        }

        setProfessionals(result.data);
        setPagination(result.pagination);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setProfessionals([]);
        setError('Não foi possível consultar os profissionais.');
      });

    return () => {
      cancelled = true;
    };
  }, [filters, page, retryKey, router]);

  function handleFilters(newFilters: Filters) {
    setProfessionals(null);
    setError('');
    setPage(1);
    setFilters(newFilters);
  }

  function handleClearFilters() {
    setProfessionals(null);
    setError('');
    setPage(1);
    setFilters(EMPTY_FILTERS);
  }

  function handlePageChange(newPage: number) {
    setProfessionals(null);
    setError('');
    setPage(newPage);
  }

  function handleRetry() {
    setProfessionals(null);
    setError('');
    setRetryKey((current) => current + 1);
  }

  return (
    <>
      <ProfessionalFilters
        filters={filters}
        onApply={handleFilters}
        onClear={handleClearFilters}
      />

      {professionals === null ? (
        <LoadingState />
      ) : error ? (
        <div className={styles.state} role="alert">
          <div>
            <h2>Não foi possível carregar os profissionais</h2>

            <p>{error}</p>

            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleRetry}
            >
              Tentar novamente
            </button>
          </div>
        </div>
      ) : professionals.length === 0 ? (
        <EmptyState
          hasFilters={
            Boolean(filters.name.trim()) ||
            Boolean(filters.specialism) ||
            Boolean(filters.ids.trim())
          }
          onClearFilters={handleClearFilters}
        />
      ) : (
        <>
          <ProfessionalList
            professionals={professionals}
            total={pagination.total}
          />

          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={handlePageChange}
          />
        </>
      )}
    </>
  );
}
