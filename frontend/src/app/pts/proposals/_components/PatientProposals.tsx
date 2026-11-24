'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import Icon from '@/components/Icon';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import { formatDate, initials } from '@/lib/format';
import { getProposals, type PtsProposal } from '@/lib/proposals';
import ProposalDecisionDialog from './ProposalDecisionDialog';
import { useProposalDecision } from './useProposalDecision';

const PAGE_LIMIT = 50;

// Visão do paciente em `propostas-pts.html`: um cartão por proposta, com a
// equipe e as ações de aprovar e rejeitar. Metas e próxima revisão ainda não
// existem na API e ficam de fora.
export default function PatientProposals() {
  const router = useRouter();
  const [proposals, setProposals] = useState<PtsProposal[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const decision = useProposalDecision((proposalId) =>
    setProposals(
      (current) =>
        current?.filter((proposal) => proposal.id !== proposalId) ?? null,
    ),
  );

  useEffect(() => {
    const controller = new AbortController();

    getProposals({ page: 1, limit: PAGE_LIMIT, signal: controller.signal })
      .then((response) => {
        setProposals(response.data);
        setFailed(false);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;

        if (error instanceof ApiError && error.status === 401) {
          router.replace('/login');
          return;
        }

        setFailed(true);
      });

    return () => controller.abort();
  }, [retryKey, router]);

  if (failed) {
    return (
      <div className={ui.empty} role="alert">
        <div className={ui.emptyIcon}>
          <Icon name="alertCircle" />
        </div>
        <h2>Não foi possível carregar as propostas</h2>
        <p>Verifique sua conexão e tente novamente</p>
        <button
          type="button"
          className={`${ui.btn} ${ui.btnSecondary}`}
          onClick={() => setRetryKey((current) => current + 1)}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!proposals) {
    return (
      <div className={ui.empty} role="status" aria-live="polite">
        <p>Carregando propostas...</p>
      </div>
    );
  }

  return (
    <>
      {decision.feedback && (
        <div className={`${ui.alert} ${ui.alertSuccess}`} role="status">
          <div className={ui.alertIcon}>
            <Icon name="checkCircle" />
          </div>
          <span>{decision.feedback}</span>
        </div>
      )}

      {proposals.length === 0 ? (
        <section className="ux-card ux-empty-card">
          <h2>Nenhuma proposta aguardando você</h2>
        </section>
      ) : (
        proposals.map((proposal) => (
          <section
            key={proposal.id}
            className="ux-card ux-proposal"
            aria-labelledby={`proposal-${proposal.id}-title`}
          >
            <div className="ux-card-head">
              <div>
                <h2 id={`proposal-${proposal.id}-title`}>
                  Proposta de PTS para você
                </h2>
                <p>
                  Criada em {formatDate(proposal.createdAt)} por{' '}
                  {proposal.responsible.name}
                </p>
              </div>
              <span className="badge draft">Aguardando sua decisão</span>
            </div>

            <div>
              <h3 className="ux-h3">Equipe</h3>
              <ul className="mini-list ux-contacts">
                {[proposal.responsible, ...proposal.team].map(
                  (member, index) => (
                    <li key={member.id}>
                      <span className="avatar" aria-hidden="true">
                        {initials(member.name)}
                      </span>
                      <span className="grow">
                        <strong>{member.name}</strong>
                        <small>
                          {member.specialism.name}
                          {index === 0 ? ', responsável' : ''}
                        </small>
                      </span>
                    </li>
                  ),
                )}
              </ul>
            </div>

            <div
              className="ux-formcard-foot"
              style={{ margin: '20px -24px -22px' }}
            >
              <button
                type="button"
                className="btn"
                onClick={() => decision.start(proposal, 'reject')}
              >
                Rejeitar proposta
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => decision.start(proposal, 'approve')}
              >
                <Icon name="check" className="icon-sm" />
                Aprovar proposta
              </button>
            </div>
          </section>
        ))
      )}

      <ProposalDecisionDialog
        decision={decision.pending?.decision ?? null}
        submitting={decision.submitting}
        error={decision.error}
        onConfirm={decision.confirm}
        onClose={decision.cancel}
      />
    </>
  );
}
