'use client';

import Modal from '@/components/Modal';
import ui from '@/components/ui.module.css';
import type { PtsProposal } from '@/lib/proposals';

type DeleteProposalDialogProps = {
  // Proposta a excluir; `null` fecha o diálogo.
  proposal: PtsProposal | null;
  submitting: boolean;
  error: string;
  onConfirm: () => void;
  onClose: () => void;
};

// Confirmação "Excluir a proposta de …?" de `propostas-pts.html` (RFPTS008).
export default function DeleteProposalDialog({
  proposal,
  submitting,
  error,
  onConfirm,
  onClose,
}: DeleteProposalDialogProps) {
  return (
    <Modal
      open={proposal !== null}
      id="proposal-delete"
      size="sm"
      title={`Excluir a proposta de ${proposal?.patient.name ?? 'paciente'}?`}
      description="A proposta sai das listagens. O registro fica guardado para auditoria."
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
            className="btn btn-danger-soft"
            disabled={submitting}
            onClick={onConfirm}
          >
            {submitting ? 'Excluindo...' : 'Excluir proposta'}
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
