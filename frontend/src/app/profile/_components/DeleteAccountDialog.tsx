'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import Icon from '@/components/Icon';
import Modal from '@/components/Modal';
import ui from '@/components/ui.module.css';
import { deleteMe } from '@/lib/account';
import { ApiError } from '@/lib/api';

type DeleteAccountDialogProps = {
  open: boolean;
  onClose: () => void;
};

const DELETE_ERROR = 'Não foi possível excluir a conta.';

// Confirmação "Excluir sua conta?" (RFAUT005) de `meu-perfil.html`. Sucesso
// deixa o botão em carregamento enquanto vai para /login; a API já encerrou
// as sessões (cookies). 401 também vai para /login; os demais erros ficam no
// diálogo, com a `message` da API.
export default function DeleteAccountDialog({
  open,
  onClose,
}: DeleteAccountDialogProps) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleClose() {
    setError('');
    onClose();
  }

  async function handleConfirm() {
    // Sem clique duplo: um envio por vez.
    if (submitting) {
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      await deleteMe();
      router.replace('/login');
    } catch (caught) {
      setSubmitting(false);

      if (caught instanceof ApiError && caught.status === 401) {
        router.replace('/login');
        return;
      }

      setError(
        caught instanceof ApiError && caught.apiMessage
          ? caught.apiMessage
          : DELETE_ERROR,
      );
    }
  }

  return (
    <Modal
      open={open}
      id="delete-dialog"
      size="sm"
      title="Excluir sua conta?"
      description="A conta perde o acesso e as sessões abertas são encerradas. Os dados clínicos são mantidos."
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
            className="btn btn-danger"
            onClick={handleConfirm}
            disabled={submitting}
          >
            <Icon name="trash" className="icon-sm" />
            {submitting ? 'Excluindo...' : 'Excluir conta'}
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
