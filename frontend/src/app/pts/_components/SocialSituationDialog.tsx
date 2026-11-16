'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import { updateSocialSituation } from '@/lib/pts';

import styles from '../pts.module.css';

type SocialSituationDialogProps = {
  open: boolean;
  ptsId: string;
  currentValue: string;
  onClose: () => void;
  onSaved: (socialSituation: string) => void;
};

const REQUIRED_MESSAGE = 'Informe a situação social.';
const SAVE_ERROR = 'Não foi possível salvar a situação social.';

// Modal "Situação social" (RFPTS005), conforme o protótipo de
// frontend/design/pts.html. <dialog> nativo, como o ProposalDecisionDialog:
// showModal() prende o foco e o Esc fecha, menos durante o envio.
export default function SocialSituationDialog({
  open,
  ptsId,
  currentValue,
  onClose,
  onSaved,
}: SocialSituationDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(currentValue);
  const [fieldError, setFieldError] = useState('');
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const socialSituation = value.trim();

    if (!socialSituation) {
      setFieldError(REQUIRED_MESSAGE);
      return;
    }

    setFieldError('');
    setApiError('');
    setSubmitting(true);

    try {
      const updated = await updateSocialSituation(ptsId, socialSituation);
      setSubmitting(false);
      onSaved(updated.socialSituation);
    } catch (error) {
      setSubmitting(false);

      if (error instanceof ApiError && error.status === 401) {
        router.replace('/login');
        return;
      }

      setApiError(
        error instanceof ApiError && error.apiMessage
          ? error.apiMessage
          : SAVE_ERROR,
      );
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={ui.dialog}
      aria-labelledby="social-situation-title"
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

          <h2 id="social-situation-title">Situação social</h2>

          <form onSubmit={handleSubmit} noValidate>
            {apiError && (
              <div className={`${ui.alert} ${ui.alertError}`} role="alert">
                <p>{apiError}</p>
              </div>
            )}

            <div className={ui.field}>
              <label htmlFor="social-situation" className={ui.label}>
                Descrição
              </label>
              <textarea
                id="social-situation"
                name="socialSituation"
                className={`${ui.input} ${styles.textarea}`}
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                  if (fieldError) {
                    setFieldError('');
                  }
                }}
                disabled={submitting}
                aria-invalid={fieldError ? true : undefined}
                aria-describedby={
                  fieldError ? 'social-situation-error' : undefined
                }
              />
              {fieldError && (
                <p id="social-situation-error" className={ui.fieldError}>
                  {fieldError}
                </p>
              )}
            </div>

            <div className={styles.dialogActions}>
              <button
                type="button"
                className={`${ui.btn} ${ui.btnSecondary}`}
                onClick={handleClose}
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={`${ui.btn} ${ui.btnPrimary}`}
                disabled={submitting}
              >
                {submitting ? 'Salvando...' : 'Salvar alteração'}
              </button>
            </div>
          </form>
        </>
      )}
    </dialog>
  );
}