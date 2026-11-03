'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import { getPatientAccounts, type AccountsResponse } from '@/lib/patients';
import styles from '../patients.module.css';
import AdminOnly from './AdminOnly';

const PAGE_LIMIT = 10;
const LOAD_ERROR = 'Verifique sua conexão e tente novamente.';

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase();
}

type PatientListProps = {
  // Termo de busca efetivo (já com debounce, trim e mínimo de 2 caracteres).
  term: string;
  onAdd: () => void;
  onClearSearch: () => void;
};

export default function PatientList({
  term,
  onAdd,
  onClearSearch,
}: PatientListProps) {
  const router = useRouter();

  // Mudar o termo volta à página 1, sem precisar de efeito extra.
  const [pageState, setPageState] = useState({ term, page: 1 });
  const page = pageState.term === term ? pageState.page : 1;
  const [retryKey, setRetryKey] = useState(0);

  // Cada consulta tem uma chave; a resposta e o erro guardam a chave de
  // origem. Assim a lista anterior continua na tela enquanto a nova carrega.
  const key = `${term}\n${page}\n${retryKey}`;
  const [last, setLast] = useState<{
    key: string;
    term: string;
    response: AccountsResponse;
  } | null>(null);
  const [failure, setFailure] = useState<{
    key: string;
    error: unknown;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    getPatientAccounts(page, PAGE_LIMIT, { q: term, signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted) {
          setLast({ key, term, response });
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          router.replace('/login');
          return;
        }

        setFailure({ key, error });
      });

    return () => controller.abort();
  }, [key, page, router, term]);

  if (failure?.key === key) {
    const { error } = failure;

    if (error instanceof ApiError && error.status === 403) {
      return (
        <AdminOnly message="Somente administradores podem consultar e adicionar pacientes." />
      );
    }

    return (
      <div className={ui.empty} role="alert">
        <div className={ui.emptyIcon}>
          <Icon name="alertCircle" />
        </div>

        <h2>Não foi possível carregar os pacientes</h2>

        <p>
          {error instanceof ApiError && error.apiMessage
            ? error.apiMessage
            : LOAD_ERROR}
        </p>

        <button
          type="button"
          className={`${ui.btn} ${ui.btnSecondary}`}
          onClick={() => setRetryKey((current) => current + 1)}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!last) {
    return (
      <div className={ui.empty} role="status" aria-live="polite">
        <div className={styles.loader} />

        <p>Carregando pacientes...</p>
      </div>
    );
  }

  const loading = last.key !== key;
  const { data: patients, pagination } = last.response;

  if (patients.length === 0) {
    if (last.term) {
      return (
        <div className={ui.empty} aria-busy={loading}>
          <div className={ui.emptyIcon}>
            <Icon name="search" />
          </div>

          <h2>Nenhum paciente encontrado</h2>

          <p>Nenhum resultado para “{last.term}”. Revise o nome ou o e-mail.</p>

          <button
            type="button"
            className={`${ui.btn} ${ui.btnSecondary}`}
            onClick={onClearSearch}
          >
            Limpar busca
          </button>
        </div>
      );
    }

    return (
      <div className={ui.empty} aria-busy={loading}>
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

  const count = last.term
    ? `${pagination.total} ${pagination.total === 1 ? 'paciente encontrado' : 'pacientes encontrados'}`
    : `${pagination.total} ${pagination.total === 1 ? 'paciente' : 'pacientes'}`;

  return (
    <>
      <div
        className={`${ui.card} ${styles.tableCard} ${loading ? styles.refreshing : ''}`}
        aria-busy={loading}
      >
        <div className={styles.tableHeader}>
          <h2>Pacientes cadastrados</h2>

          <p aria-live="polite">{loading ? 'Buscando...' : count}</p>
        </div>

        <ul className={styles.list} aria-label="Pacientes">
          {patients.map((patient) => (
            <li key={patient.id} className={styles.patientCell}>
              <span className={styles.avatar} aria-hidden="true">
                {getInitial(patient.name)}
              </span>

              <div>
                <strong>{patient.name}</strong>
                <small>{patient.email}</small>
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
            disabled={pagination.page <= 1}
            onClick={() => setPageState({ term, page: pagination.page - 1 })}
          >
            Anterior
          </button>

          <span>
            Página {pagination.page} de {pagination.totalPages}
          </span>

          <button
            type="button"
            className={`${ui.btn} ${ui.btnSecondary}`}
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => setPageState({ term, page: pagination.page + 1 })}
          >
            Próxima
          </button>
        </nav>
      )}
    </>
  );
}
