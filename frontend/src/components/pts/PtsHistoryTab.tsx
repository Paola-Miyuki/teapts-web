'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import Icon from '@/components/Icon';
import Pagination from '@/components/table/Pagination';
import PtsStatusBadge from '@/components/table/PtsStatusBadge';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { getPtsHistory, type PtsHistoryItem } from '@/lib/pts';

const DEFAULT_LIMIT = 25;

type LoadState =
  | { key: string; kind: 'loading' }
  | {
      key: string;
      kind: 'loaded';
      items: PtsHistoryItem[];
      total: number;
      totalPages: number;
    }
  | { key: string; kind: 'error'; error: unknown };

function period(item: PtsHistoryItem) {
  if (!item.beganAt) {
    return '—';
  }

  if (item.closedAt) {
    return `${formatDate(item.beganAt)} a ${formatDate(item.closedAt)}`;
  }

  return `${formatDate(item.beganAt)}, em andamento`;
}

function TeamAvatars({ item }: { item: PtsHistoryItem }) {
  const team = [item.responsible, ...item.team];
  const visible = team.slice(0, 3);

  return (
    <div className="team-stack" aria-label="Equipe do PTS">
      {visible.map((member) => (
        <span
          key={member.id}
          className={member.id === item.responsible.id ? 'lead' : undefined}
          title={member.name}
          aria-label={member.name}
        >
          {member.name.trim().charAt(0).toUpperCase()}
        </span>
      ))}
      {team.length > visible.length && (
        <span
          className="more"
          aria-label={`${team.length - visible.length} a mais`}
        >
          +{team.length - visible.length}
        </span>
      )}
    </div>
  );
}

function GoalsResult({ item }: { item: PtsHistoryItem }) {
  if (!item.goalsResult) {
    return (
      <span className="empty-cell" aria-label="Não informado">
        —
      </span>
    );
  }

  return (
    <div className="ux-result">
      <span className="badge done">{item.goalsResult.achieved} atingidas</span>
      <span className="badge partial">
        {item.goalsResult.partiallyAchieved} parcial
      </span>
      <span className="badge not-met">
        {item.goalsResult.notAchieved} não atingida
      </span>
    </div>
  );
}

export default function PtsHistoryTab({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [retryKey, setRetryKey] = useState(0);
  const requestKey = `${patientId}:${page}:${limit}:${retryKey}`;
  const [state, setState] = useState<LoadState>({
    key: '',
    kind: 'loading',
  });

  useEffect(() => {
    const controller = new AbortController();

    getPtsHistory(patientId, page, limit, controller.signal)
      .then((response) =>
        setState({
          key: requestKey,
          kind: 'loaded',
          items: response.data,
          total: response.pagination.total,
          totalPages: response.pagination.totalPages,
        }),
      )
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          router.replace('/login');
          return;
        }

        setState({ key: requestKey, kind: 'error', error });
      });

    return () => controller.abort();
  }, [patientId, page, limit, requestKey, router]);

  if (state.key !== requestKey || state.kind === 'loading') {
    return (
      <div className={ui.empty} role="status" aria-live="polite">
        <p>Carregando histórico de PTS...</p>
      </div>
    );
  }

  if (state.kind === 'error') {
    const status = state.error instanceof ApiError ? state.error.status : 0;
    const title =
      status === 403
        ? 'Sem acesso ao histórico deste paciente'
        : status === 404
          ? 'Paciente não encontrado'
          : 'Não foi possível carregar o histórico de PTS';
    const message =
      state.error instanceof ApiError && state.error.apiMessage
        ? state.error.apiMessage
        : 'Verifique sua conexão e tente novamente';

    return (
      <div className={ui.empty} role="alert">
        <div className={ui.emptyIcon}>
          <Icon name="alertCircle" />
        </div>
        <h2>{title}</h2>
        <p>{message}</p>
        {status !== 403 && status !== 404 && (
          <button
            type="button"
            className={`${ui.btn} ${ui.btnSecondary}`}
            onClick={() => setRetryKey((current) => current + 1)}
          >
            Tentar novamente
          </button>
        )}
      </div>
    );
  }

  return (
    <section className="ux-tcard" aria-labelledby="pts-history-title">
      <div className="ux-tcard-head">
        <div>
          <h2 id="pts-history-title">Histórico de PTS</h2>
          <p className="count" aria-live="polite">
            {state.total} PTS
          </p>
        </div>
      </div>

      {state.items.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">
            <Icon name="pts" className="icon" />
          </div>
          <h2>Nenhum PTS no histórico</h2>
          <p>Ainda não há PTS para este paciente.</p>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Versão</th>
                  <th scope="col">Status</th>
                  <th scope="col">Responsável</th>
                  <th scope="col">Equipe</th>
                  <th scope="col">Criado em</th>
                  <th scope="col">Período</th>
                  <th scope="col">Resultado das metas</th>
                  <th scope="col" className="nowrap">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>v{item.version}</strong>
                    </td>
                    <td>
                      <PtsStatusBadge status={item.status} />
                    </td>
                    <td>
                      {item.responsible.name}, {item.responsible.specialism}
                    </td>
                    <td>
                      <TeamAvatars item={item} />
                    </td>
                    <td className="num">{formatDate(item.createdAt)}</td>
                    <td className="nowrap">{period(item)}</td>
                    <td>
                      <GoalsResult item={item} />
                    </td>
                    <td className="nowrap">
                      <Link
                        className="btn btn-sm btn-primary"
                        href={`/pts/${encodeURIComponent(item.id)}?readonly=1&version=${item.version}`}
                      >
                        <Icon name="eye" className="icon-sm" />
                        Abrir PTS
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            limit={limit}
            total={state.total}
            totalPages={state.totalPages}
            label="Paginação do histórico de PTS"
            onPageChange={setPage}
            onLimitChange={(newLimit) => {
              setLimit(newLimit);
              setPage(1);
            }}
          />
        </>
      )}
    </section>
  );
}
