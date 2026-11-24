'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import Icon from '@/components/Icon';
import KebabMenu from '@/components/table/KebabMenu';
import Pagination, { PER_PAGE_OPTIONS } from '@/components/table/Pagination';
import PtsStatusBadge from '@/components/table/PtsStatusBadge';
import ui from '@/components/ui.module.css';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import type { Account } from '@/lib/account';
import { ApiError } from '@/lib/api';
import { formatDate, initials } from '@/lib/format';
import { can } from '@/lib/permissions';
import {
  getProposals,
  type ProposalsResponse,
  type PtsProposal,
} from '@/lib/proposals';
import ProposalDecisionDialog from './ProposalDecisionDialog';
import ProposalViewDialog, { professionalLabel } from './ProposalViewDialog';
import { useProposalDecision } from './useProposalDecision';

const DEFAULT_LIMIT = 10;
const LOAD_ERROR = 'Verifique sua conexão e tente novamente.';

function canEdit(account: Account, proposal: PtsProposal) {
  return can(account, 'editPtsProposal', {
    pts: {
      status: proposal.status,
      responsibleProfessionalId: proposal.responsible.id,
    },
  });
}

// Tabela de `propostas-pts.html` para o profissional e o admin: busca pelo
// nome do paciente e paginação na URL (`q`, `page`, `limit`).
export default function ProposalTable({ account }: { account: Account }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limitParam = Number(searchParams.get('limit'));
  const limit = PER_PAGE_OPTIONS.includes(limitParam)
    ? limitParam
    : DEFAULT_LIMIT;

  function update(changes: Record<string, string>, keepPage = false) {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(changes)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }

    params.delete('updated');

    if (!keepPage) {
      params.delete('page');
    }

    const query = params.toString();
    router.replace(query ? `/pts/proposals?${query}` : '/pts/proposals', {
      scroll: false,
    });
  }

  const search = useDebouncedSearch({
    initialTerm: searchParams.get('q') ?? '',
    onTermChange: (term) => update({ q: term }),
  });

  const [retryKey, setRetryKey] = useState(0);
  const key = [search.term, page, limit, retryKey].join('\n');
  const [last, setLast] = useState<{
    key: string;
    response: ProposalsResponse;
  } | null>(null);
  const [failure, setFailure] = useState<{
    key: string;
    error: unknown;
  } | null>(null);
  const [viewing, setViewing] = useState<PtsProposal | null>(null);

  const decision = useProposalDecision(() =>
    setRetryKey((current) => current + 1),
  );

  useEffect(() => {
    const controller = new AbortController();

    getProposals({
      page,
      limit,
      q: search.term,
      signal: controller.signal,
    })
      .then((response) => {
        if (!controller.signal.aborted) {
          setLast({ key, response });
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          router.replace('/login');
          return;
        }

        setFailure({ key, error });
      });

    return () => controller.abort();
    // `key` resume todos os parâmetros da consulta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const loading = last?.key !== key;
  const total = last?.response.pagination.total ?? 0;
  const count = last
    ? `${total} ${total === 1 ? 'proposta' : 'propostas'}`
    : 'Carregando...';
  const isAdmin = account.role === 'admin';
  const wasUpdated = searchParams.get('updated') === '1';

  return (
    <>
      {(wasUpdated || decision.feedback) && (
        <div className={`${ui.alert} ${ui.alertSuccess}`} role="status">
          <div className={ui.alertIcon}>
            <Icon name="checkCircle" />
          </div>
          <span>{decision.feedback || 'Proposta atualizada.'}</span>
        </div>
      )}

      <div className="ux-tcard" aria-busy={loading}>
        <div className="ux-tcard-head">
          <div>
            <h2>Propostas aguardando decisão</h2>
            <p className="count" aria-live="polite">
              {count}
            </p>
          </div>
        </div>

        <div className="ux-toolbar">
          <label className="field">
            <span>Busca</span>
            <span className="with-icon">
              <Icon name="search" className="icon-sm" />
              <input
                className="input"
                type="search"
                placeholder="Nome do paciente"
                value={search.input}
                onChange={(event) => search.setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    search.commit();
                  }

                  if (event.key === 'Escape') {
                    search.clear();
                  }
                }}
              />
            </span>
          </label>
          <div className="ux-tools" />
        </div>

        {failure?.key === key ? (
          <div className={ui.empty} role="alert">
            <div className={ui.emptyIcon}>
              <Icon name="alertCircle" />
            </div>
            <h2>Não foi possível carregar as propostas</h2>
            <p>
              {failure.error instanceof ApiError && failure.error.apiMessage
                ? failure.error.apiMessage
                : LOAD_ERROR}
            </p>
            <button
              type="button"
              className={`${ui.btn} ${ui.btnSecondary}`}
              onClick={() => setRetryKey((current) => current + 1)}
            >
              Tentar novamente
            </button>
          </div>
        ) : !last ? (
          <div className={ui.empty} role="status" aria-live="polite">
            <p>Carregando propostas...</p>
          </div>
        ) : last.response.data.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">
              <Icon name="search" className="icon" />
            </div>
            {search.term ? (
              <>
                <h2>Nenhuma proposta encontrada</h2>
                <p>Revise a busca.</p>
              </>
            ) : (
              <>
                <h2>Nenhuma proposta aguardando</h2>
                <p>
                  As propostas em rascunho aparecem aqui até o paciente decidir.
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Paciente</th>
                    <th scope="col">Status</th>
                    <th scope="col">Responsável</th>
                    <th scope="col">Equipe</th>
                    <th scope="col">Criado em</th>
                    <th scope="col" className="actions-col">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {last.response.data.map((proposal) => (
                    <tr key={proposal.id}>
                      <td>
                        <div className="person">
                          <span className="avatar" aria-hidden="true">
                            {proposal.patient.name.charAt(0).toUpperCase()}
                          </span>
                          <div>
                            <strong>{proposal.patient.name}</strong>
                          </div>
                        </div>
                      </td>
                      <td className="nowrap">
                        <PtsStatusBadge status={proposal.status} />
                      </td>
                      <td>{professionalLabel(proposal.responsible)}</td>
                      <td>
                        <div className="team-stack">
                          {[proposal.responsible, ...proposal.team].map(
                            (member, index) => {
                              const role =
                                index === 0 ? 'responsável' : 'membro';

                              return (
                                <span
                                  key={member.id}
                                  className={index === 0 ? 'lead' : ''}
                                  tabIndex={0}
                                  title={`${member.name}, ${member.specialism.name}, ${role}`}
                                  aria-label={`${member.name}, ${member.specialism.name}, ${role}`}
                                >
                                  {initials(member.name)}
                                </span>
                              );
                            },
                          )}
                        </div>
                      </td>
                      <td className="num">{formatDate(proposal.createdAt)}</td>
                      <td className="actions-col">
                        <KebabMenu
                          label={`Ações para proposta de ${proposal.patient.name}`}
                        >
                          <li>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => setViewing(proposal)}
                            >
                              <Icon name="eye" className="icon-sm" />
                              Ver proposta
                            </button>
                          </li>
                          {canEdit(account, proposal) && (
                            <li>
                              <Link
                                role="menuitem"
                                href={`/pts/proposals/${proposal.id}/edit`}
                              >
                                <Icon name="edit" className="icon-sm" />
                                Editar proposta
                              </Link>
                            </li>
                          )}
                          {isAdmin && (
                            <>
                              <li>
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() =>
                                    decision.start(proposal, 'approve')
                                  }
                                >
                                  <Icon name="check" className="icon-sm" />
                                  Aprovar em nome do paciente
                                </button>
                              </li>
                              <li>
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() =>
                                    decision.start(proposal, 'reject')
                                  }
                                >
                                  <Icon name="close" className="icon-sm" />
                                  Rejeitar em nome do paciente
                                </button>
                              </li>
                            </>
                          )}
                        </KebabMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              label="Paginação de propostas"
              page={last.response.pagination.page}
              limit={limit}
              total={total}
              totalPages={last.response.pagination.totalPages}
              onPageChange={(next) =>
                update({ page: next > 1 ? String(next) : '' }, true)
              }
              onLimitChange={(next) =>
                update({ limit: next === DEFAULT_LIMIT ? '' : String(next) })
              }
            />
          </>
        )}
      </div>

      <ProposalViewDialog
        proposal={viewing}
        canEdit={viewing ? canEdit(account, viewing) : false}
        onClose={() => setViewing(null)}
      />

      <ProposalDecisionDialog
        decision={decision.pending?.decision ?? null}
        onBehalfOf={decision.pending?.proposal.patient.name}
        submitting={decision.submitting}
        error={decision.error}
        onConfirm={decision.confirm}
        onClose={decision.cancel}
      />
    </>
  );
}
