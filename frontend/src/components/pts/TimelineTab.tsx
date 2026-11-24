'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import Icon from '@/components/Icon';
import Pagination, { PER_PAGE_OPTIONS } from '@/components/table/Pagination';
import ui from '@/components/ui.module.css';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { ApiError } from '@/lib/api';
import {
  formatTimelineTime,
  getTimeline,
  groupTimelineByDay,
  TIMELINE_TYPE_ICONS,
  TIMELINE_TYPE_LABELS,
  timelineLink,
  type TimelineOrder,
  type TimelinePerson,
  type TimelineRecord,
  type TimelineResponse,
  type TimelineTargetType,
} from '@/lib/timeline';
import TimelineFilters, {
  hasTimelineFilters,
  periodRange,
  type TimelineFilterValue,
  type TimelinePeriod,
} from './TimelineFilters';
import styles from './timeline.module.css';

const LOAD_ERROR = 'Verifique sua conexão e tente novamente.';
const DEFAULT_LIMIT = PER_PAGE_OPTIONS[0];
const TYPES = Object.keys(TIMELINE_TYPE_LABELS) as TimelineTargetType[];
const PERIODS: TimelinePeriod[] = ['30', '90', 'custom'];

type TimelineUrlState = {
  q: string;
  filters: TimelineFilterValue;
  order: TimelineOrder;
  page: number;
  limit: number;
};

// Busca, filtros, ordem e página ficam na URL (NFUS003).
function readUrlState(): TimelineUrlState {
  const params = new URLSearchParams(
    typeof window === 'undefined' ? '' : window.location.search,
  );
  const period = params.get('period') as TimelinePeriod;
  const limit = Number(params.get('limit'));

  return {
    q: params.get('q') ?? '',
    filters: {
      types: (params.get('type') ?? '')
        .split(',')
        .filter((type): type is TimelineTargetType =>
          TYPES.includes(type as TimelineTargetType),
        ),
      authorId: params.get('author') ?? '',
      period: PERIODS.includes(period) ? period : '',
      from: period === 'custom' ? (params.get('from') ?? '') : '',
      to: period === 'custom' ? (params.get('to') ?? '') : '',
    },
    order: params.get('order') === 'asc' ? 'asc' : 'desc',
    page: Math.max(1, Number(params.get('page')) || 1),
    limit: PER_PAGE_OPTIONS.includes(limit) ? limit : DEFAULT_LIMIT,
  };
}

function writeUrlState(state: TimelineUrlState) {
  const params = new URLSearchParams();
  const { filters } = state;
  const entries: [string, string][] = [
    ['q', state.q],
    ['type', filters.types.join(',')],
    ['author', filters.authorId],
    ['period', filters.period],
    ['from', filters.period === 'custom' ? filters.from : ''],
    ['to', filters.period === 'custom' ? filters.to : ''],
    ['order', state.order === 'asc' ? 'asc' : ''],
    ['page', state.page > 1 ? String(state.page) : ''],
    ['limit', state.limit === DEFAULT_LIMIT ? '' : String(state.limit)],
  ];

  for (const [key, value] of entries) {
    if (value) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ''}#timeline`;

  if (
    url !==
    `${window.location.pathname}${window.location.search}${window.location.hash}`
  ) {
    window.history.replaceState(window.history.state, '', url);
  }
}

type TimelineTabProps = {
  ptsId: string;
  patientId: string;
  team: TimelinePerson[];
  isPatient: boolean;
};

export default function TimelineTab({
  ptsId,
  patientId,
  team,
  isPatient,
}: TimelineTabProps) {
  const router = useRouter();
  const [initial] = useState(readUrlState);
  const [filters, setFilters] = useState<TimelineFilterValue>(initial.filters);
  const [order, setOrder] = useState<TimelineOrder>(initial.order);
  const [page, setPage] = useState(initial.page);
  const [limit, setLimit] = useState(initial.limit);
  const [retryKey, setRetryKey] = useState(0);
  const search = useDebouncedSearch({
    initialTerm: initial.q,
    onTermChange: () => setPage(1),
  });

  useEffect(() => {
    writeUrlState({ q: search.term, filters, order, page, limit });
  }, [search.term, filters, order, page, limit]);

  const range = useMemo(() => periodRange(filters), [filters]);
  const key = [
    search.term,
    filters.types.join(','),
    filters.authorId,
    range.from,
    range.to,
    order,
    page,
    limit,
    retryKey,
  ].join('\n');

  const [last, setLast] = useState<{
    key: string;
    response: TimelineResponse;
  } | null>(null);
  const [failure, setFailure] = useState<{
    key: string;
    error: unknown;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    getTimeline(ptsId, {
      page,
      limit,
      q: search.term,
      types: filters.types,
      authorId: filters.authorId,
      from: range.from,
      to: range.to,
      order,
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
  }, [ptsId, key]);

  function changeFilters(next: TimelineFilterValue) {
    setFilters(next);
    setPage(1);
  }

  const loading = last?.key !== key;
  const total = last?.response.pagination.total ?? 0;
  const filtered = Boolean(search.term) || hasTimelineFilters(filters);
  const count = last
    ? `${total} ${total === 1 ? 'evento' : 'eventos'}${filtered ? ' com os filtros atuais' : ''}`
    : 'Carregando...';

  return (
    <div className="ux-tcard" aria-busy={loading}>
      <div className="ux-tcard-head">
        <div>
          <h2>Timeline</h2>
          <p className="count" aria-live="polite">
            {count}
          </p>
        </div>
      </div>

      <TimelineFilters
        search={search}
        value={filters}
        onChange={changeFilters}
        order={order}
        onOrderChange={(next) => {
          setOrder(next);
          setPage(1);
        }}
        searchProfessionals={!isPatient}
        team={team}
      />

      {failure?.key === key ? (
        <div className={ui.empty} role="alert">
          <div className={ui.emptyIcon}>
            <Icon name="alertCircle" />
          </div>
          <h2>Não foi possível carregar a timeline</h2>
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
          <p>Carregando timeline...</p>
        </div>
      ) : last.response.data.length === 0 ? (
        <div className={ui.empty}>
          <div className={ui.emptyIcon}>
            <Icon name={filtered ? 'search' : 'clock'} />
          </div>
          {filtered ? (
            <>
              <h2>Nenhum evento</h2>
              <p>Revise a busca ou limpe os filtros.</p>
            </>
          ) : (
            <>
              <h2>Nenhum evento registrado</h2>
              <p>As mudanças do PTS aparecem aqui.</p>
            </>
          )}
        </div>
      ) : (
        <>
          <div className={`table-wrap ${loading ? styles.refreshing : ''}`}>
            <table className="table ux-feed">
              <thead>
                <tr>
                  <th scope="col">Evento</th>
                </tr>
              </thead>
              <tbody>
                {groupTimelineByDay(last.response.data).map((group) => (
                  <Fragment key={group.day}>
                    <tr className="group-row">
                      <td>{group.day}</td>
                    </tr>
                    {group.records.map((record) => (
                      <tr key={record.id}>
                        <td>
                          <TimelineEvent
                            record={record}
                            patientId={patientId}
                            isPatient={isPatient}
                          />
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            label="Paginação da timeline"
            page={last.response.pagination.page}
            limit={limit}
            total={last.response.pagination.total}
            totalPages={last.response.pagination.totalPages}
            onPageChange={setPage}
            onLimitChange={(next) => {
              setLimit(next);
              setPage(1);
            }}
          />
        </>
      )}
    </div>
  );
}

function TimelineEvent({
  record,
  patientId,
  isPatient,
}: {
  record: TimelineRecord;
  patientId: string;
  isPatient: boolean;
}) {
  const link =
    isPatient && record.targetType === 'document'
      ? null
      : timelineLink(record, patientId);

  return (
    <article className="ux-ev ux-tl">
      <span className="ux-tl-ic" aria-hidden="true">
        <Icon
          name={TIMELINE_TYPE_ICONS[record.targetType]}
          className="icon-sm"
        />
      </span>
      <div className="ux-ev-main">
        <p className="ux-tl-text">{record.description}</p>
        <dl className="ux-ev-facts">
          <div>
            <dt>Hora</dt>
            <dd>{formatTimelineTime(record.happenedAt)}</dd>
          </div>
          <div>
            <dt>Autor</dt>
            <dd>{record.author.name}</dd>
          </div>
          {record.assignedTo && (
            <div>
              <dt>Atribuído a</dt>
              <dd>{record.assignedTo.name}</dd>
            </div>
          )}
          <div>
            <dt>Tipo</dt>
            <dd>{TIMELINE_TYPE_LABELS[record.targetType]}</dd>
          </div>
        </dl>
      </div>
      <div className="ux-ev-actions">
        {link &&
          (link.href.startsWith('#') ? (
            <a className="link" href={link.href}>
              {link.label}
            </a>
          ) : (
            <Link className="link" href={link.href}>
              {link.label}
            </Link>
          ))}
      </div>
    </article>
  );
}
