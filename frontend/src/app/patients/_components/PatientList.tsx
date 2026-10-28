'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import { getPatientAccounts, type AccountsResponse } from '@/lib/patients';
import styles from '../patients.module.css';

const PAGE_LIMIT = 10;

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase();
}

type PatientListProps = {
  onAdd: () => void;
};

export default function PatientList({ onAdd }: PatientListProps) {
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [retryKey, setRetryKey] = useState(0);
  // null = carregando.
  const [result, setResult] = useState<AccountsResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getPatientAccounts(page, PAGE_LIMIT)
      .then((response) => {
        if (!cancelled) {
          setResult(response);
        }
      })
      .catch((reason: unknown) => {
        if (cancelled) {
          return;
        }

        if (reason instanceof ApiError && reason.status === 401) {
          router.replace('/login');
          return;
        }

        setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [page, retryKey, router]);

  function load(nextPage: number) {
    setResult(null);
    setError(false);
    setPage(nextPage);
    setRetryKey((current) => current + 1);
  }

  if (error) {
    return (
      <div className={ui.empty} role="alert">
        <div className={ui.emptyIcon}>
          <Icon name="alertCircle" />
        </div>

        <h2>Não foi possível carregar os pacientes</h2>

        <p>Verifique sua conexão e tente novamente.</p>

        <button
          type="button"
          className={`${ui.btn} ${ui.btnSecondary}`}
          onClick={() => load(page)}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!result) {
    return (
      <div className={ui.empty} role="status" aria-live="polite">
        <div className={styles.loader} />

        <p>Carregando pacientes...</p>
      </div>
    );
  }

  const { data: patients, pagination } = result;

  if (patients.length === 0) {
    return (
      <div className={ui.empty}>
        <div className={ui.emptyIcon}>
          <Icon name="patient" />
        </div>

        <h2>Nenhum paciente cadastrado</h2>

        <p>Adicione uma conta já cadastrada como paciente para começar.</p>

        <button
          type="button"
          className={`${ui.btn} ${ui.btnPrimary} ${styles.create}`}
          onClick={onAdd}
        >
          <Icon name="plus" className={ui.icon} />
          Adicionar paciente
        </button>
      </div>
    );
  }

  return (
    <>
      <div className={`${ui.card} ${styles.tableCard}`}>
        <div className={styles.tableHeader}>
          <h2>Pacientes cadastrados</h2>

          <p>
            {pagination.total}{' '}
            {pagination.total === 1 ? 'paciente' : 'pacientes'}
          </p>
        </div>

        <ul className={styles.list} aria-label="Pacientes">
          {patients.map((patient) => (
            <li key={patient.id} className={styles.patientCell}>
              <span className={styles.avatar} aria-hidden="true">
                {getInitial(patient.name)}
              </span>

              <div>
                <strong>{patient.name}</strong>
                <small>Perfil de paciente</small>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {pagination.totalPages > 1 && (
        <nav className={styles.pagination} aria-label="Paginação de pacientes">
          <button
            type="button"
            className={`${ui.btn} ${ui.btnSecondary}`}
            disabled={page <= 1}
            onClick={() => load(page - 1)}
          >
            Anterior
          </button>

          <span>
            Página {page} de {pagination.totalPages}
          </span>

          <button
            type="button"
            className={`${ui.btn} ${ui.btnSecondary}`}
            disabled={page >= pagination.totalPages}
            onClick={() => load(page + 1)}
          >
            Próxima
          </button>
        </nav>
      )}
    </>
  );
}
