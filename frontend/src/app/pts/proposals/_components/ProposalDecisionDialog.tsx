'use client';

import { useEffect, useRef } from 'react';

import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';

import type { ProposalDecision } from '../api';
import styles from '../proposals.module.css';

type ProposalDecisionDialogProps = {
  decision: ProposalDecision | null;
  submitting: boolean;
  error: string;
  onConfirm: () => void;
  onClose: () => void;
};

const COPY: Record<
  ProposalDecision,
  { title: string; message: string; confirm: string }
> = {
  approve: {
    title: 'Aceitar proposta?',
    message:
      'As outras propostas pendentes serão rejeitadas e o PTS entra em planejamento.',
    confirm: 'Escolher esta equipe',
  },
  reject: {
    title: 'Rejeitar proposta?',
    message:
      'A proposta sai da sua lista. As outras continuam aguardando sua decisão.',
    confirm: 'Rejeitar',
  },
};

// <dialog> nativo, como o AddPatientModal: showModal() prende o foco e o Esc
// fecha. Durante o envio, o Esc e o clique no fundo não fecham.
export default function ProposalDecisionDialog({
  decision,
  submitting,
  error,
  onConfirm,
  onClose,
}: ProposalDecisionDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const open = decision !== null;

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function handleClose() {
    if (!submitting) {
      onClose();
    }
  }

  const copy = decision ? COPY[decision] : null;

  return (
    <dialog
      ref={dialogRef}
      className={ui.dialog}
      aria-labelledby="proposal-decision-title"
      onCancel={(event) => {
        event.preventDefault();
        handleClose();
      }}
      onClose={handleClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          handleClose();
        }
      }}
    >
      {copy && (
        <>
          <button
            type="button"
            className={`${ui.iconButton} ${ui.dialogClose}`}
            aria-label="Fechar janela"
            onClick={handleClose}
            disabled={submitting}
          >
            <Icon name="close" className={ui.icon} />
          </button>

          <h2 id="proposal-decision-title">{copy.title}</h2>

          <p>{copy.message}</p>

          {error && (
            <div className={`${ui.alert} ${ui.alertError}`} role="alert">
              <p>{error}</p>
            </div>
          )}

          <div className={styles.decisionActions}>
            <button
              type="button"
              className={`${ui.btn} ${ui.btnSecondary}`}
              onClick={handleClose}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={`${ui.btn} ${ui.btnPrimary}`}
              onClick={onConfirm}
              disabled={submitting}
            >
              {submitting ? 'Enviando...' : copy.confirm}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
