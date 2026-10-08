'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import styles from '../pacientes.module.css';
import EmptyState from './EmptyState';
import LoadingState from './LoadingState';
import Pagination from './Pagination';
import PatientList from './PatientList';

type Patient = {
  id: number | string;
  name: string;
};

type PaginationData = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type AuthorizedPatientsResponse = {
  data: Patient[];
  pagination: PaginationData;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

const PAGE_LIMIT = 10;

export default function AuthorizedPatients() {
  const router = useRouter();

  const [patients, setPatients] = useState<Patient[] | null>(null);
  const [page, setPage] = useState(1);
  const [retryKey, setRetryKey] = useState(0);

  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: PAGE_LIMIT,
    total: 0,
    totalPages: 1,
  });

  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_URL}/patients/authorized?page=${page}&limit=${PAGE_LIMIT}`, {
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
          setPatients([]);
          setError('Não foi possível consultar os pacientes autorizados.');
          return;
        }

        const result = (await response.json()) as AuthorizedPatientsResponse;

        if (cancelled) {
          return;
        }

        setPatients(result.data);
        setPagination(result.pagination);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setPatients([]);
        setError('Não foi possível consultar os pacientes autorizados.');
      });

    return () => {
      cancelled = true;
    };
  }, [page, retryKey, router]);

  function handlePageChange(newPage: number) {
    setPatients(null);
    setError('');
    setPage(newPage);
  }

  function handleRetry() {
    setPatients(null);
    setError('');
    setRetryKey((current) => current + 1);
  }

  if (patients === null) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <div className={styles.state} role="alert">
        <div>
          <h2>Não foi possível carregar os pacientes</h2>

          <p>{error}</p>

          <button
            type="button"
            className={styles.errorButton}
            onClick={handleRetry}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (patients.length === 0) {
    return <EmptyState />;
  }

  return (
    <>
      <PatientList patients={patients} />

      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        onPageChange={handlePageChange}
      />
    </>
  );
}
