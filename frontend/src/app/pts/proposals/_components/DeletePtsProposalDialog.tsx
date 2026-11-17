'use client';

import { useEffect, useRef } from 'react';

import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';

import styles from '../proposals.module.css';

type DeletePtsProposalDialogProps = {
  open: boolean;
  submitting: boolean;
  error: string;
  onConfirm: () => void;
  onClose: () => void;
};

// Confirmação de "Excluir proposta" (RFPTS008). <dialog> nativo, como o
// AddPatientModal: showModal() prende o foco e o Esc fecha. Durante o envio,
// o Esc e o clique no fundo não fecham.
export default function DeletePtsProposalDialog({
  open,
  submitting,
  error,
  onConfirm,
  onClose,
}: DeletePtsProposalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

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

  return (
    <dialog
      ref={dialogRef}
      className={ui.dialog}
      aria-labelledby="delete-proposal-title"
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
      {open && (
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

          <h2 id="delete-proposal-title">Excluir proposta?</h2>

          <p>
            A proposta deixa de aparecer para o paciente e para a equipe. As
            outras propostas não mudam.
          </p>

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
              {submitting ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
