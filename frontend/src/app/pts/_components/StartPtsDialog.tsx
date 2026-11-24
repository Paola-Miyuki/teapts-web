'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import Modal from '@/components/Modal';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import { startPts, type PtsStartResponse } from '@/lib/pts';

type StartPtsDialogProps = {
  open: boolean;
  ptsId: string;
  patientName: string;
  onClose: () => void;
  onStarted: (started: PtsStartResponse) => void;
};

const START_ERROR = 'Não foi possível iniciar a execução do PTS.';

// Confirmação "Iniciar a execução do PTS de ...?" (RFPTS006) de
// `pts-planejamento.html`.
export default function StartPtsDialog({
  open,
  ptsId,
  patientName,
  onClose,
  onStarted,
}: StartPtsDialogProps) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleClose() {
    setError('');
    onClose();
  }

  async function handleConfirm() {
    if (submitting) {
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const started = await startPts(ptsId);
      setSubmitting(false);
      onStarted(started);
    } catch (caught) {
      setSubmitting(false);

      if (caught instanceof ApiError && caught.status === 401) {
        router.replace('/login');
        return;
      }

      setError(
        caught instanceof ApiError && caught.apiMessage
          ? caught.apiMessage
          : START_ERROR,
      );
    }
  }

  return (
    <Modal
      open={open}
      id="start-pts"
      size="sm"
      title={`Iniciar a execução do PTS de ${patientName}?`}
      description="O PTS passa para Em andamento e a data de início é registrada na timeline."
      busy={submitting}
      onClose={handleClose}
      footer={
        <>
          <button
            type="button"
            className="btn"
            onClick={handleClose}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting ? 'Iniciando...' : 'Iniciar execução'}
          </button>
        </>
      }
    >
      {error && (
        <div className={`${ui.alert} ${ui.alertError}`} role="alert">
          <p>{error}</p>
        </div>
      )}
    </Modal>
  );
}
