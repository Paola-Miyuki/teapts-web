'use client';

import { useState } from 'react';

import Icon from '@/components/Icon';
import Modal from '@/components/Modal';
import ui from '@/components/ui.module.css';
import { deactivateAccount } from '@/lib/accounts';
import { ApiError } from '@/lib/api';
import type { Professional } from '@/lib/professionals';

const DEACTIVATE_ERROR = 'Não foi possível desativar o profissional';

type DeactivateProfessionalDialogProps = {
  professional: Professional | null;
  onClose: () => void;
  onDeactivated: (professional: Professional) => void;
  // A API recusou: o profissional é responsável por PTS ativo.
  onBlocked: (professional: Professional) => void;
  onUnauthorized: () => void;
};

// Confirmação "Desativar <nome>?" (RFPRO004, RFAUT005) de `profissionais.html`.
// Chama `DELETE /accounts/:accountId`; 401 vai para o login e os demais erros
// (`409` inclusive) ficam no diálogo, com a `message` da API.
export default function DeactivateProfessionalDialog({
  professional,
  onClose,
  onDeactivated,
  onBlocked,
  onUnauthorized,
}: DeactivateProfessionalDialogProps) {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function handleClose() {
    setError('');
    onClose();
  }

  async function handleConfirm() {
    // Sem clique duplo: um envio por vez.
    if (!professional?.accountId || submitting) {
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      await deactivateAccount(professional.accountId);
      setSubmitting(false);
      onDeactivated(professional);
    } catch (caught) {
      setSubmitting(false);

      if (caught instanceof ApiError && caught.status === 401) {
        onUnauthorized();
        return;
      }

      if (
        caught instanceof ApiError &&
        caught.code === 'ACCOUNT_IS_PTS_RESPONSIBLE'
      ) {
        onBlocked(professional);
      }

      setError(
        caught instanceof ApiError && caught.apiMessage
          ? caught.apiMessage
          : DEACTIVATE_ERROR,
      );
    }
  }

  const name = professional?.name ?? '';

  return (
    <Modal
      open={professional !== null}
      id="professional-deactivate"
      size="sm"
      title={`Desativar ${name}?`}
      description={`A conta fica inativa e as sessões abertas são encerradas. ${name} sai das equipes de PTS em planejamento ou em andamento e perde o acesso aos PTS. Os registros já feitos mantêm a autoria.`}
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
            <Icon name="lock" className="icon-sm" />
            {submitting ? 'Desativando...' : 'Desativar profissional'}
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
