import { request } from '@/lib/api';

export type Notification = {
  id: string;
  type: 'review_window';
  message: string;
  ptsId: string;
  createdAt: string;
  readAt: string | null;
};

export type NotificationsResponse = {
  data: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  unreadCount: number;
};

const CHANGED_EVENT = 'teapts:notifications-changed';

/** Avisa o sino do cabeçalho que o total de não lidas mudou. */
export function notifyNotificationsChanged() {
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

export function onNotificationsChanged(listener: () => void) {
  window.addEventListener(CHANGED_EVENT, listener);

  return () => window.removeEventListener(CHANGED_EVENT, listener);
}

export function getNotifications(
  { unread, page, limit }: { unread: boolean; page: number; limit: number },
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    ...(unread && { unread: 'true' }),
    page: String(page),
    limit: String(limit),
  });

  return request<NotificationsResponse>(`/notifications?${params.toString()}`, {
    signal,
  });
}

export function getUnreadCount(signal?: AbortSignal) {
  return request<{ unreadCount: number }>('/notifications/unread-count', {
    signal,
  });
}

export function markNotificationAsRead(id: string) {
  return request<Notification>(
    `/notifications/${encodeURIComponent(id)}/read`,
    // A leitura é gravada mesmo com a página já trocando para o PTS.
    { method: 'POST', keepalive: true },
  );
}

export function markAllNotificationsAsRead() {
  return request<{ status: 'OK' }>('/notifications/read-all', {
    method: 'POST',
  });
}
