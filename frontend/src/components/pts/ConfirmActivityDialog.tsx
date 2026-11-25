'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import FormField from '@/components/FormField';
import Modal from '@/components/Modal';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';

const FORM_ID = 'activity-confirm';

type ConfirmActivityDialogProps = {
  title: string;
  description: string;
  confirmLabel: string;
  busyLabel: string;
  errorMessage: string;
  // Chamada com o motivo já aparado; vazio, vai undefined.
  onConfirm: (reason?: string) => Promise<unknown>;
  onDone: () => void;
  onClose: () => void;
};

// Confirmação das ações da atividade com motivo opcional (`data-confirm` de
// `pts-detalhe.html`). Monte só com o diálogo aberto, para o motivo começar
// vazio.
export default function ConfirmActivityDialog({
  title,
  description,
  confirmLabel,
  busyLabel,
  errorMessage,
  onConfirm,
  onDone,
  onClose,
}: ConfirmActivityDialogProps) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await onConfirm(reason.trim() || undefined);
      onDone();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        router.replace('/login');
        return;
      }

      setError(
        failure instanceof ApiError && failure.apiMessage
          ? failure.apiMessage
          : errorMessage,
      );
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      id={FORM_ID}
      size="sm"
      title={title}
      description={description}
      busy={submitting}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="btn"
            disabled={submitting}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={submitting}
            aria-busy={submitting}
            onClick={confirm}
          >
            {submitting ? busyLabel : confirmLabel}
          </button>
        </>
      }
    >
      {error && (
        <div className={`${ui.alert} ${ui.alertError}`} role="alert">
          <p>{error}</p>
        </div>
      )}

      <FormField id={`${FORM_ID}-reason`} label="Motivo" required={false} full>
        <textarea
          id={`${FORM_ID}-reason`}
          className="input"
          rows={3}
          disabled={submitting}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </FormField>
    </Modal>
  );
}
