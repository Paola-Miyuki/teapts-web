'use client';

import Modal from '@/components/Modal';
import ui from '@/components/ui.module.css';

import type { ProposalDecision } from '../api';

type ProposalDecisionDialogProps = {
  decision: ProposalDecision | null;
  // Nome do paciente quando o admin decide em nome dele (RN029).
  onBehalfOf?: string;
  submitting: boolean;
  error: string;
  onConfirm: () => void;
  onClose: () => void;
};

const COPY: Record<
  ProposalDecision,
  { title: string; message: string; confirm: string; className: string }
> = {
  approve: {
    title: 'Aprovar a proposta?',
    message:
      'O PTS passa para Em planejamento e a equipe começa a organizar as atividades.',
    confirm: 'Aprovar proposta',
    className: 'btn btn-primary',
  },
  reject: {
    title: 'Rejeitar a proposta?',
    message: 'A proposta fica como Rejeitada. A equipe pode montar outra.',
    confirm: 'Rejeitar proposta',
    className: 'btn btn-danger-soft',
  },
};

// Confirmação de `propostas-pts.html` (decide-approve e decide-reject).
export default function ProposalDecisionDialog({
  decision,
  onBehalfOf,
  submitting,
  error,
  onConfirm,
  onClose,
}: ProposalDecisionDialogProps) {
  const copy = decision ? COPY[decision] : COPY.approve;
  const title =
    onBehalfOf && decision
      ? `${decision === 'approve' ? 'Aprovar' : 'Rejeitar'} a proposta em nome de ${onBehalfOf}?`
      : copy.title;

  return (
    <Modal
      open={decision !== null}
      id="proposal-decision"
      size="sm"
      title={title}
      description={copy.message}
      busy={submitting}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={copy.className}
            onClick={onConfirm}
            disabled={submitting}
          >
            {submitting ? 'Enviando...' : copy.confirm}
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
