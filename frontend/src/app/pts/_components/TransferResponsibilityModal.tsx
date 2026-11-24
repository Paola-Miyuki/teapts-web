'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import Modal from '@/components/Modal';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import { getProfessionals, type Professional } from '@/lib/professionals';
import { transferPtsResponsibility, type PtsTeamResponse } from '@/lib/pts';

import styles from '../pts.module.css';

type TransferResponsibilityModalProps = {
  open: boolean;
  ptsId: string;
  currentResponsibleId: string;
  onClose: () => void;
  onTransferred: (pts: PtsTeamResponse) => void;
};

const TRANSFER_ERROR = 'Não foi possível transferir a responsabilidade.';

export default function TransferResponsibilityModal({
  open,
  ptsId,
  currentResponsibleId,
  onClose,
  onTransferred,
}: TransferResponsibilityModalProps) {
  const router = useRouter();
  const { input, setInput, term, commit, isTooShort } = useDebouncedSearch({
    minLength: 2,
  });
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [conflictId, setConflictId] = useState('');
  const [loadedTerm, setLoadedTerm] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const isSearching = open && loadedTerm !== term;

  useEffect(() => {
    if (!open) {
      return;
    }

    const controller = new AbortController();
    let active = true;
    const queryTerm = term;

    getProfessionals(
      { page: 1, limit: 10, q: queryTerm || undefined },
      controller.signal,
    )
      .then(({ data }) => {
        if (active) {
          setProfessionals(
            data.filter(
              (professional) => professional.id !== currentResponsibleId,
            ),
          );
        }
      })
      .catch((caught: unknown) => {
        if (
          !active ||
          (caught instanceof Error && caught.name === 'AbortError')
        ) {
          return;
        }

        if (caught instanceof ApiError && caught.status === 401) {
          router.replace('/login');
          return;
        }

        setError(
          caught instanceof ApiError && caught.apiMessage
            ? caught.apiMessage
            : 'Não foi possível buscar profissionais.',
        );
      })
      .finally(() => {
        if (active) {
          setLoadedTerm(queryTerm);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [currentResponsibleId, open, router, term]);

  function handleSearchChange(value: string) {
    setInput(value);
    setSelectedId('');
    setConflictId('');
    setError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedId || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError('');
    setConflictId('');

    try {
      const updatedPts = await transferPtsResponsibility(ptsId, selectedId);
      onTransferred(updatedPts);
      onClose();
    } catch (caught: unknown) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace('/login');
        return;
      }

      if (
        caught instanceof ApiError &&
        caught.status === 400 &&
        caught.code === 'TEAM_DUPLICATE_ACCOUNT'
      ) {
        setConflictId(selectedId);
      }

      setError(
        caught instanceof ApiError && caught.apiMessage
          ? caught.apiMessage
          : TRANSFER_ERROR,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      id="transfer-responsibility"
      title="Transferir responsabilidade?"
      description="O novo profissional assumirá o PTS e você deixará de ter acesso às ações da equipe."
      busy={isSubmitting}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className={`${ui.btn} ${ui.btnSecondary}`}
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="transfer-responsibility-form"
            className={`${ui.btn} ${ui.btnPrimary}`}
            disabled={isSubmitting || !selectedId}
          >
            {isSubmitting ? 'Transferindo...' : 'Transferir'}
          </button>
        </>
      }
    >
      <form id="transfer-responsibility-form" onSubmit={handleSubmit}>
        <label className={ui.field}>
          <span className={ui.label}>Buscar profissional por nome</span>
          <input
            className={ui.input}
            type="search"
            value={input}
            onChange={(event) => handleSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commit();
              }
            }}
            placeholder="Nome do profissional"
            disabled={isSubmitting}
          />
        </label>

        {isTooShort && (
          <p className={ui.hint}>Digite pelo menos 2 caracteres para buscar.</p>
        )}

        {error && (
          <div className={`${ui.alert} ${ui.alertError}`} role="alert">
            <p>{error}</p>
          </div>
        )}

        <div className={styles.transferCandidates} aria-live="polite">
          {isSearching ? (
            <p role="status">Buscando profissionais...</p>
          ) : isTooShort ? null : professionals.length === 0 ? (
            <p>Nenhum profissional encontrado.</p>
          ) : (
            <ul>
              {professionals.map((professional) => {
                const hasConflict = conflictId === professional.id;

                return (
                  <li
                    key={professional.id}
                    className={
                      hasConflict ? styles.transferConflict : undefined
                    }
                  >
                    <label>
                      <input
                        type="radio"
                        name="newResponsibleId"
                        value={professional.id}
                        checked={selectedId === professional.id}
                        onChange={() => {
                          setSelectedId(professional.id);
                          setError('');
                          setConflictId('');
                        }}
                        disabled={isSubmitting}
                      />
                      <span>
                        <strong>{professional.name}</strong>
                        <small>{professional.specialism.name}</small>
                        {hasConflict && (
                          <small className={styles.transferConflictLabel}>
                            Conta já presente na equipe
                          </small>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </form>
    </Modal>
  );
}
