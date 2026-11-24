'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import Modal from '@/components/Modal';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import { deleteSupportContact, type SupportContact } from '@/lib/patients';

const REMOVE_ERROR = 'Não foi possível remover o contato';

type RemoveSupportContactDialogProps = {
  patientId: string;
  // Contato a remover; `null` fecha o diálogo.
  contact: SupportContact | null;
  onRemoved: (contact: SupportContact) => void;
  onClose: () => void;
};

// Confirmação "Remover … dos contatos de suporte?" de `paciente.html`.
export default function RemoveSupportContactDialog({
  patientId,
  contact,
  onRemoved,
  onClose,
}: RemoveSupportContactDialogProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function close() {
    setError('');
    onClose();
  }

  async function confirm() {
    if (!contact || submitting) {
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await deleteSupportContact(patientId, contact.id);
      onRemoved(contact);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        router.replace('/login');
        return;
      }

      setError(
        failure instanceof ApiError && failure.apiMessage
          ? failure.apiMessage
          : REMOVE_ERROR,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={contact !== null}
      id="support-contact-remove"
      size="sm"
      title={`Remover ${contact?.name ?? 'contato'} dos contatos de suporte?`}
      description="Só este contato sai da lista. Os outros não mudam."
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
            {submitting ? 'Removendo...' : 'Remover contato'}
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
