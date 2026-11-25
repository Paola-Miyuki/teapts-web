'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import FormField from '@/components/FormField';
import Modal from '@/components/Modal';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import { todayDateOnly } from '@/lib/format';
import {
  closePts,
  type ClosePtsResponse,
  type PtsCloseOutcome,
} from '@/lib/pts';

const CLOSE_ERROR = 'Não foi possível encerrar o PTS';
const FORM_ID = 'pts-close';

type ClosePtsDialogProps = {
  ptsId: string;
  patientName: string;
  onClosed: (closed: ClosePtsResponse) => void;
  onClose: () => void;
};

// Modal "Encerrar PTS" (`pts-close` de `pts-detalhe.html`). Monte só com o
// diálogo aberto.
export default function ClosePtsDialog({
  ptsId,
  patientName,
  onClosed,
  onClose,
}: ClosePtsDialogProps) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<PtsCloseOutcome>('concluded');
  const [closingDate, setClosingDate] = useState(todayDateOnly);
  const [reason, setReason] = useState('');
  const [dateError, setDateError] = useState('');
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setApiError('');
    setDateError(closingDate ? '' : 'Informe a data de encerramento');

    if (!closingDate) {
      return;
    }

    setSubmitting(true);

    try {
      const closed = await closePts(ptsId, {
        outcome,
        closingDate,
        ...(reason.trim() && { reason: reason.trim() }),
      });

      onClosed(closed);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        router.replace('/login');
        return;
      }

      setApiError(
        failure instanceof ApiError && failure.apiMessage
          ? failure.apiMessage
          : CLOSE_ERROR,
      );
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      id={FORM_ID}
      size="sm"
      title="Encerrar PTS"
      description={`PTS de ${patientName}`}
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
            type="submit"
            form={FORM_ID}
            className="btn btn-primary"
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting ? 'Encerrando...' : 'Encerrar PTS'}
          </button>
        </>
      }
    >
      <form id={FORM_ID} noValidate onSubmit={handleSubmit}>
        {apiError && (
          <div className={`${ui.alert} ${ui.alertError}`} role="alert">
            <p>{apiError}</p>
          </div>
        )}

        <div className="form-grid">
          <FormField id={`${FORM_ID}-outcome`} label="Como encerrar" full>
            <select
              id={`${FORM_ID}-outcome`}
              className="select"
              aria-required
              disabled={submitting}
              value={outcome}
              onChange={(event) =>
                setOutcome(event.target.value as PtsCloseOutcome)
              }
            >
              <option value="concluded">Concluir: o plano foi cumprido</option>
              <option value="cancelled">
                Cancelar: o plano foi interrompido
              </option>
            </select>
          </FormField>

          <FormField
            id={`${FORM_ID}-date`}
            label="Data de encerramento"
            error={dateError}
          >
            <input
              id={`${FORM_ID}-date`}
              className="input"
              type="date"
              aria-required
              aria-invalid={Boolean(dateError)}
              aria-describedby={dateError ? `${FORM_ID}-date-error` : undefined}
              disabled={submitting}
              value={closingDate}
              onChange={(event) => setClosingDate(event.target.value)}
            />
          </FormField>

          <FormField
            id={`${FORM_ID}-reason`}
            label="Motivo do encerramento"
            required={false}
            full
          >
            <textarea
              id={`${FORM_ID}-reason`}
              className="input"
              rows={3}
              placeholder="Ex.: metas do ciclo atingidas"
              disabled={submitting}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </FormField>
        </div>

        <p className="muted">
          O PTS encerrado fica só para leitura e não volta a ficar ativo.
        </p>
      </form>
    </Modal>
  );
}
