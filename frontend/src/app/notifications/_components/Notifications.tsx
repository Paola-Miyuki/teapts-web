'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import Icon from '@/components/Icon';
import Pagination from '@/components/table/Pagination';
import ui from '@/components/ui.module.css';
import { ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  notifyNotificationsChanged,
  type Notification,
  type NotificationsResponse,
} from '@/lib/notifications';

const LOAD_ERROR = 'Verifique sua conexão e tente novamente.';
const READ_ALL_ERROR = 'Não foi possível marcar as notificações como lidas';

type LoadState =
  | { key: string; kind: 'loaded'; response: NotificationsResponse }
  | { key: string; kind: 'error'; error: unknown }
  | null;

// Tela de `notificacoes.html`.
export default function Notifications({ isPatient }: { isPatient: boolean }) {
  const router = useRouter();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<LoadState>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const requestKey = `${unreadOnly}:${page}:${limit}:${reloadKey}`;

  useEffect(() => {
    const controller = new AbortController();

    getNotifications({ unread: unreadOnly, page, limit }, controller.signal)
      .then((response) =>
        setState({ key: requestKey, kind: 'loaded', response }),
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
  }, [unreadOnly, page, limit, requestKey, router]);

  function reload() {
    setReloadKey((current) => current + 1);
  }

  function changeTab(unread: boolean) {
    setUnreadOnly(unread);
    setPage(1);
  }

  function open(notification: Notification) {
    if (notification.readAt) {
      return;
    }

    // A falha não impede de abrir o PTS: a notificação só continua não lida.
    markNotificationAsRead(notification.id)
      .then(() => {
        notifyNotificationsChanged();
        reload();
      })
      .catch(() => undefined);
  }

  async function markAll() {
    setSubmitting(true);
    setActionError('');

    try {
      await markAllNotificationsAsRead();
      notifyNotificationsChanged();
      setPage(1);
      reload();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace('/login');
        return;
      }

      setActionError(
        error instanceof ApiError && error.apiMessage
          ? error.apiMessage
          : READ_ALL_ERROR,
      );
    } finally {
      setSubmitting(false);
    }
  }

  const current = state?.key === requestKey ? state : null;
  const loaded = current?.kind === 'loaded' ? current.response : null;
  const total = loaded?.pagination.total ?? 0;

  return (
    <div className="ux-tcard">
      <div className="ux-tcard-head">
        <div>
          <h2>Notificações</h2>
          <p className="count" aria-live="polite">
            {loaded &&
              `${total} ${total === 1 ? 'notificação' : 'notificações'}`}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm"
          disabled={submitting || !loaded || loaded.unreadCount === 0}
          aria-busy={submitting}
          onClick={markAll}
        >
          <Icon name="check" className="icon-sm" />
          {submitting ? 'Marcando...' : 'Marcar todas como lidas'}
        </button>
      </div>

      <div
        className="chip-filter ux-tabs"
        role="group"
        aria-label="Filtrar por situação"
      >
        <button
          type="button"
          aria-pressed={!unreadOnly}
          onClick={() => changeTab(false)}
        >
          Todas
        </button>
        <button
          type="button"
          aria-pressed={unreadOnly}
          onClick={() => changeTab(true)}
        >
          Não lidas
        </button>
      </div>

      {actionError && (
        <div className={`${ui.alert} ${ui.alertError}`} role="alert">
          <p>{actionError}</p>
        </div>
      )}

      {!current ? (
        <div className={ui.empty} role="status" aria-live="polite">
          <p>Carregando notificações...</p>
        </div>
      ) : current.kind === 'error' ? (
        <div className={ui.empty} role="alert">
          <div className={ui.emptyIcon}>
            <Icon name="alertCircle" />
          </div>
          <h2>Não foi possível carregar as notificações</h2>
          <p>
            {current.error instanceof ApiError && current.error.apiMessage
              ? current.error.apiMessage
              : LOAD_ERROR}
          </p>
          <button
            type="button"
            className={`${ui.btn} ${ui.btnSecondary}`}
            onClick={reload}
          >
            Tentar novamente
          </button>
        </div>
      ) : current.response.data.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">
            <Icon name="bell" className="icon" />
          </div>
          <h2>
            {unreadOnly
              ? 'Nenhuma notificação não lida'
              : 'Nenhuma notificação'}
          </h2>
          <p>Você está em dia.</p>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table ux-notes-t">
              <thead>
                <tr>
                  <th scope="col">Notificação</th>
                </tr>
              </thead>
              <tbody>
                {current.response.data.map((notification) => (
                  <tr key={notification.id}>
                    <td>
                      <div
                        className={`ux-note-item${notification.readAt ? '' : ' is-unread'}`}
                      >
                        <span className="ux-note-ic" aria-hidden="true">
                          <Icon name="clock" />
                        </span>
                        <div>
                          <span className="ux-note-title">
                            {isPatient
                              ? 'Sua reavaliação está próxima'
                              : 'Reavaliação próxima'}
                          </span>
                          <p>{notification.message}</p>
                          <small>
                            {`${formatDateTime(notification.createdAt)} · ${
                              notification.readAt ? 'lida' : 'não lida'
                            }`}
                          </small>
                        </div>
                        {/* O responsável passa a abrir a reavaliação com a RFEVA005. */}
                        <Link
                          className="btn btn-sm"
                          href={
                            isPatient
                              ? '/pts'
                              : `/pts/${encodeURIComponent(notification.ptsId)}`
                          }
                          onClick={() => open(notification)}
                        >
                          {isPatient ? 'Ver meu PTS' : 'Abrir PTS'}
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            limit={limit}
            total={total}
            totalPages={current.response.pagination.totalPages}
            label="Paginação das notificações"
            onPageChange={setPage}
            onLimitChange={(newLimit) => {
              setLimit(newLimit);
              setPage(1);
            }}
          />
        </>
      )}
    </div>
  );
}
