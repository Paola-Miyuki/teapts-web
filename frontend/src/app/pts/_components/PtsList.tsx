'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import Icon from '@/components/Icon';
import KebabMenu from '@/components/table/KebabMenu';
import MultiSelect from '@/components/table/MultiSelect';
import Pagination, { PER_PAGE_OPTIONS } from '@/components/table/Pagination';
import ProfessionalFilter from '@/components/table/ProfessionalFilter';
import PtsStatusBadge from '@/components/table/PtsStatusBadge';
import ui from '@/components/ui.module.css';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import type { Account } from '@/lib/account';
import { ApiError } from '@/lib/api';
import { formatDate, initials } from '@/lib/format';
import { can } from '@/lib/permissions';
import {
  getPtsList,
  type PtsListItem,
  type PtsListOrder,
  type PtsListResponse,
  type PtsListSort,
} from '@/lib/pts-list';
import {
  PTS_STATUS_LABELS,
  PTS_STATUSES,
  type PtsStatus,
} from '@/lib/pts-status';
import DeleteProposalDialog from '../proposals/_components/DeleteProposalDialog';
import { useDeleteProposal } from '../proposals/_components/useDeleteProposal';
import ClosePtsDialog from './ClosePtsDialog';
import StartPtsDialog from './StartPtsDialog';

const LOAD_ERROR = 'Verifique sua conexão e tente novamente';
const DEFAULT_LIMIT = PER_PAGE_OPTIONS[0];
// A equipe mostra até 3 avatares; o resto vira "+N".
const MAX_AVATARS = 3;
const RANGE_DAYS: Record<string, number> = { '30': 30, '90': 90 };

const STATUS_OPTIONS = PTS_STATUSES.map((value) => ({
  value,
  label: PTS_STATUS_LABELS[value],
}));

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function EmptyCell() {
  return (
    <span className="empty-cell" aria-label="Não informado">
      —
    </span>
  );
}

function memberLabel(
  member: PtsListItem['responsible'],
  role: 'responsável' | 'membro',
) {
  return `${member.name}, ${member.specialism.name}, ${role}`;
}

function period(pts: PtsListItem) {
  if (pts.closedAt) {
    return pts.beganAt
      ? `${formatDate(pts.beganAt)} até ${formatDate(pts.closedAt)}`
      : `Até ${formatDate(pts.closedAt)}`;
  }

  return pts.beganAt ? `${formatDate(pts.beganAt)}, em andamento` : null;
}

function ptsPermission(pts: PtsListItem) {
  return {
    pts: {
      status: pts.status,
      responsibleProfessionalId: pts.responsible.id,
      teamProfessionalIds: pts.team.map((member) => member.id),
    },
  };
}

function TeamStack({ pts }: { pts: PtsListItem }) {
  const members = [
    { member: pts.responsible, role: 'responsável' as const },
    ...pts.team.map((member) => ({ member, role: 'membro' as const })),
  ];
  const shown = members.slice(0, MAX_AVATARS);
  const hidden = members.slice(MAX_AVATARS);

  return (
    <div className="team-stack">
      {shown.map(({ member, role }, index) => (
        <span
          key={member.id}
          className={index === 0 ? 'lead' : ''}
          tabIndex={0}
          title={memberLabel(member, role)}
          aria-label={memberLabel(member, role)}
        >
          {initials(member.name)}
        </span>
      ))}

      {hidden.length > 0 && (
        <span
          className="more"
          tabIndex={0}
          title={hidden
            .map(({ member }) => `${member.name}, ${member.specialism.name}`)
            .join('\n')}
          aria-label={`Mais ${hidden.length}: ${hidden
            .map(({ member }) => member.name)
            .join(', ')}`}
        >
          +{hidden.length}
        </span>
      )}
    </div>
  );
}

// Lista de PTS de `lista-pts.html` (RFPTS002, RFPTS004, RFPTS009): o admin vê
// todos e o profissional, os da equipe. Busca, filtros, ordenação e paginação
// ficam na URL para valer ao recarregar e ao voltar.
function PtsListContent({ account }: { account: Account }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAdmin = account.role === 'admin';
  const ownProfessionalId = account.professionalProfileIds[0] ?? '';

  const status = (searchParams.get('status') ?? '')
    .split(',')
    .filter((value): value is PtsStatus =>
      (PTS_STATUSES as readonly string[]).includes(value),
    );
  const responsibleId = searchParams.get('responsible') ?? '';
  const memberId = searchParams.get('member') ?? '';
  const created = searchParams.get('created') ?? '';
  const createdFromParam = searchParams.get('createdFrom') ?? '';
  const createdToParam = searchParams.get('createdTo') ?? '';
  const sort: PtsListSort =
    searchParams.get('sort') === 'status' ? 'status' : 'createdAt';
  const order: PtsListOrder =
    searchParams.get('order') === 'asc' ? 'asc' : 'desc';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limitParam = Number(searchParams.get('limit'));
  const limit = PER_PAGE_OPTIONS.includes(limitParam)
    ? limitParam
    : DEFAULT_LIMIT;

  // Grava os parâmetros na URL; mudar busca ou filtro volta à página 1.
  function update(changes: Record<string, string>, keepPage = false) {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(changes)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }

    if (!keepPage) {
      params.delete('page');
    }

    const query = params.toString();
    router.replace(query ? `/pts?${query}` : '/pts', { scroll: false });
  }

  const search = useDebouncedSearch({
    initialTerm: searchParams.get('q') ?? '',
    onTermChange: (term) => update({ q: term }),
  });

  const hasFilters =
    status.length > 0 || Boolean(responsibleId || memberId || created);
  const [filtersOpen, setFiltersOpen] = useState(hasFilters);

  const range = useMemo(() => {
    if (created === 'custom') {
      return { from: createdFromParam, to: createdToParam };
    }

    const days = RANGE_DAYS[created];

    if (!days) {
      return { from: '', to: '' };
    }

    const from = new Date();
    from.setDate(from.getDate() - days);

    return { from: isoDate(from), to: '' };
  }, [created, createdFromParam, createdToParam]);

  const [retryKey, setRetryKey] = useState(0);
  const [success, setSuccess] = useState('');
  const [starting, setStarting] = useState<PtsListItem | null>(null);
  const [closing, setClosing] = useState<PtsListItem | null>(null);
  const removal = useDeleteProposal(() =>
    setRetryKey((current) => current + 1),
  );
  const key = [
    search.term,
    status.join(','),
    responsibleId,
    memberId,
    range.from,
    range.to,
    sort,
    order,
    page,
    limit,
    retryKey,
  ].join('\n');
  const [last, setLast] = useState<{
    key: string;
    response: PtsListResponse;
  } | null>(null);
  const [failure, setFailure] = useState<{
    key: string;
    error: unknown;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    getPtsList({
      page,
      limit,
      q: search.term,
      status,
      responsibleId,
      memberId,
      createdFrom: range.from,
      createdTo: range.to,
      sort: sort === 'createdAt' ? undefined : sort,
      order: order === 'desc' ? undefined : order,
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
  const filtered = Boolean(search.term) || hasFilters;
  const count = last
    ? `${total} PTS${filtered ? ' com os filtros atuais' : ''}`
    : 'Carregando...';
  const feedback = success || removal.feedback;

  function clearFilters() {
    update({
      status: '',
      responsible: '',
      member: '',
      created: '',
      createdFrom: '',
      createdTo: '',
    });
  }

  function reload(message: string) {
    setStarting(null);
    setClosing(null);
    setSuccess(message);
    setRetryKey((current) => current + 1);
  }

  return (
    <>
      <div className="heading">
        <div>
          <h1>Projetos Terapêuticos Singulares</h1>
        </div>

        <div className="heading-actions">
          <Link className="btn" href="/pts/proposals">
            Propostas
          </Link>

          {can(account, 'createPts') && (
            <Link className="btn btn-primary" href="/pts/novo">
              <Icon name="plus" className="icon-sm" />
              Criar proposta de PTS
            </Link>
          )}
        </div>
      </div>

      {feedback && (
        <div className={`${ui.alert} ${ui.alertSuccess}`} role="status">
          <div className={ui.alertIcon}>
            <Icon name="checkCircle" />
          </div>
          <span>{feedback}</span>
        </div>
      )}

      <div className="ux-tcard" aria-busy={loading}>
        <div className="ux-tcard-head">
          <div>
            <h2>PTS</h2>
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
                placeholder="Nome ou CNS do paciente"
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

          <div className="ux-tools">
            <button
              type="button"
              className="btn filter-toggle"
              aria-expanded={filtersOpen}
              aria-controls="pts-more"
              onClick={() => setFiltersOpen((current) => !current)}
            >
              <Icon name="filter" className="icon-sm" />
              Filtros
            </button>

            {hasFilters && (
              <button type="button" className="btn" onClick={clearFilters}>
                <Icon name="close" className="icon-sm" />
                Limpar
              </button>
            )}

            <label className="ux-sort" htmlFor="pts-sort">
              <span>Ordenar por</span>
              <select
                className="select"
                id="pts-sort"
                value={sort}
                onChange={(event) =>
                  update({
                    sort: event.target.value === 'status' ? 'status' : '',
                  })
                }
              >
                <option value="createdAt">Data de criação</option>
                <option value="status">Status</option>
              </select>
              <button
                type="button"
                className="btn btn-sm sort-dir"
                data-dir={order}
                aria-label={
                  order === 'asc' ? 'Ordem crescente' : 'Ordem decrescente'
                }
                onClick={() => update({ order: order === 'desc' ? 'asc' : '' })}
              >
                <Icon
                  name={order === 'asc' ? 'sortUp' : 'sortDown'}
                  className="icon-sm"
                />
              </button>
            </label>
          </div>
        </div>

        <div className="filter-more" id="pts-more" hidden={!filtersOpen}>
          <MultiSelect
            label="Status do PTS"
            placeholder="Todos os status"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(value) => update({ status: value.join(',') })}
          />

          <ProfessionalFilter
            label="Responsável"
            value={responsibleId}
            onChange={(id) => update({ responsible: id })}
          />

          {!isAdmin && ownProfessionalId && (
            <label className="shortcut">
              <input
                type="checkbox"
                checked={responsibleId === ownProfessionalId}
                onChange={(event) =>
                  update({
                    responsible: event.target.checked ? ownProfessionalId : '',
                  })
                }
              />{' '}
              Sou responsável
            </label>
          )}

          <ProfessionalFilter
            label="Membro da equipe"
            value={memberId}
            onChange={(id) => update({ member: id })}
          />

          <div className="field">
            <label className="field-label" htmlFor="pts-created">
              Data de criação
            </label>
            <select
              className="select"
              id="pts-created"
              value={created}
              onChange={(event) =>
                update({
                  created: event.target.value,
                  createdFrom: '',
                  createdTo: '',
                })
              }
            >
              <option value="">Qualquer data</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
              <option value="custom">Personalizado</option>
            </select>

            {created === 'custom' && (
              <div className="range-custom">
                <input
                  className="input"
                  type="date"
                  aria-label="De"
                  value={createdFromParam}
                  onChange={(event) =>
                    update({ createdFrom: event.target.value })
                  }
                />
                <input
                  className="input"
                  type="date"
                  aria-label="Até"
                  value={createdToParam}
                  onChange={(event) =>
                    update({ createdTo: event.target.value })
                  }
                />
              </div>
            )}
          </div>
        </div>

        {failure?.key === key ? (
          <div className={ui.empty} role="alert">
            <div className={ui.emptyIcon}>
              <Icon name="alertCircle" />
            </div>
            <h2>Não foi possível carregar os PTS</h2>
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
            <p>Carregando PTS...</p>
          </div>
        ) : last.response.data.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">
              <Icon name={filtered ? 'search' : 'clipboard'} className="icon" />
            </div>
            {filtered ? (
              <>
                <h2>Nenhum PTS encontrado</h2>
                <p>Revise a busca ou limpe os filtros.</p>
              </>
            ) : (
              <>
                <h2>Nenhum PTS</h2>
                <p>Os PTS aparecem aqui.</p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table" id="pts">
                <thead>
                  <tr>
                    <th scope="col">Paciente</th>
                    <th scope="col">Status</th>
                    <th scope="col">Versão</th>
                    <th scope="col">Responsável</th>
                    <th scope="col">Equipe</th>
                    <th scope="col">Criado em</th>
                    <th scope="col">Período</th>
                    <th scope="col" className="actions-col">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {last.response.data.map((pts) => {
                    const permission = ptsPermission(pts);
                    const canEditProposal = can(
                      account,
                      'editPtsProposal',
                      permission,
                    );
                    const canEdit = can(account, 'editPts', permission);
                    const canStart = can(account, 'startPts', permission);
                    const canReassess = can(
                      account,
                      'registerPtsReassessment',
                      permission,
                    );
                    const canClose = can(account, 'closePts', permission);
                    const canDelete = can(
                      account,
                      'deletePtsProposal',
                      permission,
                    );
                    const dates = period(pts);

                    return (
                      <tr key={pts.id}>
                        <td>
                          <div className="person">
                            <span className="avatar" aria-hidden="true">
                              {pts.patient.name.charAt(0).toUpperCase()}
                            </span>
                            <div>
                              <strong>{pts.patient.name}</strong>
                            </div>
                          </div>
                        </td>
                        <td className="nowrap">
                          <PtsStatusBadge status={pts.status} />
                        </td>
                        <td className="ux-col-md">{pts.version}º PTS</td>
                        <td>
                          {pts.responsible.name},{' '}
                          {pts.responsible.specialism.name}
                        </td>
                        <td>
                          <TeamStack pts={pts} />
                        </td>
                        <td className="num">{formatDate(pts.createdAt)}</td>
                        <td className="nowrap">{dates ?? <EmptyCell />}</td>
                        <td className="actions-col">
                          <KebabMenu
                            label={`Ações para PTS de ${pts.patient.name}`}
                          >
                            <li>
                              <Link role="menuitem" href={`/pts/${pts.id}`}>
                                <Icon name="eye" className="icon-sm" />
                                Visualizar
                              </Link>
                            </li>
                            {canEditProposal && (
                              <li>
                                <Link
                                  role="menuitem"
                                  href={`/pts/proposals/${pts.id}/edit`}
                                >
                                  <Icon name="edit" className="icon-sm" />
                                  Editar proposta
                                </Link>
                              </li>
                            )}
                            {canEdit && (
                              <li>
                                <Link
                                  role="menuitem"
                                  href={`/pts/${pts.id}/edit`}
                                >
                                  <Icon name="edit" className="icon-sm" />
                                  Editar PTS
                                </Link>
                              </li>
                            )}
                            {canStart && (
                              <li>
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setSuccess('');
                                    setStarting(pts);
                                  }}
                                >
                                  <Icon name="check" className="icon-sm" />
                                  Iniciar execução
                                </button>
                              </li>
                            )}
                            {/* Desabilitado até existir a tela de reavaliação (RFEVA005). */}
                            {canReassess && (
                              <li>
                                <button type="button" role="menuitem" disabled>
                                  <Icon
                                    name="checkCircle"
                                    className="icon-sm"
                                  />
                                  Registrar reavaliação
                                </button>
                              </li>
                            )}
                            {canClose && (
                              <li>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="danger"
                                  onClick={() => {
                                    setSuccess('');
                                    setClosing(pts);
                                  }}
                                >
                                  <Icon name="lock" className="icon-sm" />
                                  Encerrar
                                </button>
                              </li>
                            )}
                            {canDelete && (
                              <li>
                                <div className="sep" />
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="danger"
                                  onClick={() => {
                                    setSuccess('');
                                    removal.start({ ...pts, status: 'draft' });
                                  }}
                                >
                                  <Icon name="trash" className="icon-sm" />
                                  Excluir
                                </button>
                              </li>
                            )}
                          </KebabMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              label="Paginação de PTS"
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

      {starting && (
        <StartPtsDialog
          open
          ptsId={starting.id}
          patientName={starting.patient.name}
          onClose={() => setStarting(null)}
          onStarted={() => reload('Execução do PTS iniciada')}
        />
      )}

      {closing && (
        <ClosePtsDialog
          ptsId={closing.id}
          patientName={closing.patient.name}
          onClosed={() => reload('PTS encerrado')}
          onClose={() => setClosing(null)}
        />
      )}

      <DeleteProposalDialog
        proposal={removal.pending}
        submitting={removal.submitting}
        error={removal.error}
        onConfirm={removal.confirm}
        onClose={removal.cancel}
      />
    </>
  );
}

export default function PtsList({ account }: { account: Account }) {
  return (
    <Suspense fallback={null}>
      <PtsListContent account={account} />
    </Suspense>
  );
}
