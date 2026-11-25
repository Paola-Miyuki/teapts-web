'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import Icon from '@/components/Icon';
import { getUnreadCount, onNotificationsChanged } from '@/lib/notifications';

// Sino do cabeçalho (`ux-bell`). Sem o contador, o link continua funcionando.
export default function NotificationBell({ current }: { current: boolean }) {
  const [unread, setUnread] = useState<number | null>(null);

  useEffect(() => {
    let controller = new AbortController();

    function load() {
      controller.abort();
      controller = new AbortController();

      getUnreadCount(controller.signal)
        .then(({ unreadCount }) => setUnread(unreadCount))
        .catch(() => undefined);
    }

    load();
    const unsubscribe = onNotificationsChanged(load);

    return () => {
      unsubscribe();
      controller.abort();
    };
  }, []);

  return (
    <Link
      href="/notifications"
      className="ux-bell"
      aria-current={current ? 'page' : undefined}
      aria-label={
        unread === null
          ? 'Notificações'
          : `Notificações: ${unread} não lida${unread === 1 ? '' : 's'}`
      }
      title="Notificações"
    >
      <Icon name="bell" className="icon" />
      {unread !== null && unread > 0 && (
        <span className="ux-bell-n" aria-hidden="true">
          {unread}
        </span>
      )}
    </Link>
  );
}
