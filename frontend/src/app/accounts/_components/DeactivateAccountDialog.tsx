'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import Icon from '@/components/Icon';
import Modal from '@/components/Modal';
import ui from '@/components/ui.module.css';
import { deactivateAccount } from '@/lib/accounts';
import { ApiError } from '@/lib/api';

type DeactivateAccountDialogProps = {
  account: { id: string; name: string } | null;
  onClose: () => void;
  onDeactivated: (id: string, name: string) => void;
  // Textos do diálogo; sem eles, os de "Desativar conta" de `contas.html`.
  // "Excluir paciente" (`pacientes.html`) usa o mesmo `DELETE /accounts/:id`.
  title?: string;
  description?: string;
  confirmLabel?: string;
  confirmingLabel?: string;
  errorMessage?: string;
  icon?: 'lock' | 'trash';
};

const DEACTIVATE_ERROR = 'Não foi possível desativar a conta';

// Confirmação "Desativar a conta de ...?" de `contas.html` (RFAUT005). 401 vai
// para /login; os demais erros (ex.: 409 `ACCOUNT_IS_PTS_RESPONSIBLE` e
// `ACCOUNT_ALREADY_DEACTIVATED`) ficam no diálogo, com a `message` da API.
export default function DeactivateAccountDialog({
  account,
  onClose,
  onDeactivated,
  title = `Desativar a conta de ${account?.name ?? ''}?`,
  description = 'A conta e os perfis vinculados ficam inativos e as sessões abertas são encerradas. Os dados e os registros são mantidos.',
  confirmLabel = 'Desativar conta',
  confirmingLabel = 'Desativando...',
  errorMessage = DEACTIVATE_ERROR,
  icon = 'lock',
}: DeactivateAccountDialogProps) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleClose() {
    setError('');
    onClose();
  }

  async function handleConfirm() {
    if (!account || submitting) {
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      await deactivateAccount(account.id);
    } catch (caught) {
      setSubmitting(false);

      if (caught instanceof ApiError && caught.status === 401) {
        router.replace('/login');
        return;
      }

      setError(
        caught instanceof ApiError && caught.apiMessage
          ? caught.apiMessage
          : errorMessage,
      );
      return;
    }

    setSubmitting(false);
    onDeactivated(account.id, account.name);
  }

  return (
    <Modal
      open={account !== null}
      id="deactivate-account"
      size="sm"
      title={title}
      description={description}
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
            <Icon name={icon} className="icon-sm" />
            {submitting ? confirmingLabel : confirmLabel}
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
