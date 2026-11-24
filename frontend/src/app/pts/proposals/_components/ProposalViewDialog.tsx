'use client';

import Link from 'next/link';

import Icon from '@/components/Icon';
import Modal from '@/components/Modal';
import { formatDate } from '@/lib/format';
import type { ProposalProfessional, PtsProposal } from '@/lib/proposals';

type ProposalViewDialogProps = {
  proposal: PtsProposal | null;
  canEdit: boolean;
  onClose: () => void;
};

export function professionalLabel(professional: ProposalProfessional) {
  return `${professional.name}, ${professional.specialism.name}`;
}

// "Ver proposta" de `propostas-pts.html`. Diagnóstico e metas ainda não
// existem na API e ficam de fora.
export default function ProposalViewDialog({
  proposal,
  canEdit,
  onClose,
}: ProposalViewDialogProps) {
  return (
    <Modal
      open={proposal !== null}
      id="proposal-view"
      title={proposal ? `Proposta de ${proposal.patient.name}` : ''}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Fechar
          </button>
          {proposal && canEdit && (
            <Link
              className="btn btn-primary"
              href={`/pts/proposals/${proposal.id}/edit`}
            >
              <Icon name="edit" className="icon-sm" />
              Editar proposta
            </Link>
          )}
        </>
      }
    >
      {proposal && (
        <>
          <section>
            <dl className="ux-dl">
              <div>
                <dt>Situação</dt>
                <dd>
                  <span className="badge draft">Aguardando o paciente</span>
                </dd>
              </div>
              <div>
                <dt>Criada em</dt>
                <dd>{formatDate(proposal.createdAt)}</dd>
              </div>
            </dl>
          </section>

          {proposal.socialSituation && (
            <section>
              <h3>Situação social</h3>
              <p style={{ margin: 0 }}>{proposal.socialSituation}</p>
            </section>
          )}

          <section>
            <h3>Equipe e prazos</h3>
            <dl className="ux-dl">
              <div>
                <dt>Responsável</dt>
                <dd>{professionalLabel(proposal.responsible)}</dd>
              </div>
              <div>
                <dt>Membros</dt>
                <dd>
                  {proposal.team.length > 0 ? (
                    proposal.team.map(professionalLabel).join('; ')
                  ) : (
                    <span className="empty-cell" aria-label="Não informado">
                      —
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </section>
        </>
      )}
    </Modal>
  );
}
