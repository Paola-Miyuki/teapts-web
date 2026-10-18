'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import {
  getProfessionals,
  type PaginationData,
  type Professional,
  type ProfessionalSpecialism,
} from '@/lib/professionals';
import EmptyState from './EmptyState';
import LoadingState from './LoadingState';
import Pagination from './Pagination';
import ProfessionalFilters from './ProfessionalFilters';
import ProfessionalList from './ProfessionalList';

export type Filters = {
  name: string;
  specialism: ProfessionalSpecialism | '';
  ids: string;
};

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

    getProfessionals({
      page,
      limit: PAGE_LIMIT,
      name: filters.name,
      specialism: filters.specialism || undefined,
      ids: filters.ids.split(','),
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        setProfessionals(result.data);
        setPagination(result.pagination);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          router.replace('/login');
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
        <div className={ui.empty} role="alert">
          <h2>Não foi possível carregar os profissionais</h2>

          <p>{error}</p>

          <button
            type="button"
            className={`${ui.btn} ${ui.btnSecondary}`}
            onClick={handleRetry}
          >
            Tentar novamente
          </button>
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
