'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import Modal from '@/components/Modal';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import { deleteDocument } from '@/lib/documents';

const DELETE_ERROR = 'Não foi possível excluir o documento';

type DeleteDocumentDialogProps = {
  // Documento a excluir; `null` fecha o diálogo.
  document: { id: string; title: string } | null;
  onDeleted: (id: string) => void;
  onClose: () => void;
};

// Confirmação "Excluir …?" da aba Documentos de `paciente.html` (RFDOC006).
export default function DeleteDocumentDialog({
  document,
  onDeleted,
  onClose,
}: DeleteDocumentDialogProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function close() {
    setError('');
    onClose();
  }

  async function confirm() {
    if (!document || submitting) {
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await deleteDocument(document.id);
      onDeleted(document.id);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        router.replace('/login');
        return;
      }

      setError(
        failure instanceof ApiError && failure.apiMessage
          ? failure.apiMessage
          : DELETE_ERROR,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={document !== null}
      id="document-delete"
      size="sm"
      title={`Excluir "${document?.title ?? 'documento'}"?`}
      description="O documento sai da lista, mas continua no histórico do paciente. O arquivo não é apagado."
      busy={submitting}
      onClose={close}
      footer={
        <>
          <button
            type="button"
            className="btn"
            disabled={submitting}
            onClick={close}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-danger-soft"
            disabled={submitting}
            onClick={confirm}
          >
            {submitting ? 'Excluindo...' : 'Excluir documento'}
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
