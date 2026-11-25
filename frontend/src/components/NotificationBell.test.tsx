import { act, render, screen } from '@testing-library/react';

import { notifyNotificationsChanged } from '@/lib/notifications';

import NotificationBell from './NotificationBell';

function mockCount(...counts: (number | Error)[]) {
  global.fetch = jest.fn(async () => {
    const next = counts.length > 1 ? counts.shift() : counts[0];
    if (next instanceof Error) {
      throw next;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ unreadCount: next }),
    } as Response;
  }) as jest.Mock;
}

describe('NotificationBell (RFNOT002)', () => {
  it('mostra as não lidas e leva às notificações', async () => {
    mockCount(2);
    render(<NotificationBell current={false} />);

    const bell = await screen.findByRole('link', {
      name: 'Notificações: 2 não lidas',
    });
    expect(bell).toHaveAttribute('href', '/notifications');
    expect(bell).not.toHaveAttribute('aria-current');
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('sem não lidas, não mostra o número', async () => {
    mockCount(0);
    render(<NotificationBell current />);

    const bell = await screen.findByRole('link', {
      name: 'Notificações: 0 não lidas',
    });
    expect(bell).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('atualiza o contador quando as notificações mudam', async () => {
    mockCount(2, 1);
    render(<NotificationBell current={false} />);
    await screen.findByRole('link', { name: 'Notificações: 2 não lidas' });

    act(() => notifyNotificationsChanged());

    expect(
      await screen.findByRole('link', { name: 'Notificações: 1 não lida' }),
    ).toBeInTheDocument();
  });

  it('continua no cabeçalho quando o contador falha', async () => {
    mockCount(new Error('offline'));
    render(<NotificationBell current={false} />);
    await act(async () => undefined);

    expect(
      screen.getByRole('link', { name: 'Notificações' }),
    ).toBeInTheDocument();
  });
});
