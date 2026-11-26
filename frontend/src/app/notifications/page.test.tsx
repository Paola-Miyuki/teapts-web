import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useRouter } from 'next/navigation';

import type { Account } from '@/lib/account';
import { personalData } from '@/test-utils/account';

import NotificationsPage from './page';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const PROFESSIONAL: Account = {
  accountId: 'acc-1',
  name: 'Ana Souza',
  email: 'ana@example.com',
  role: 'user',
  ...personalData,
  patientProfileId: null,
  professionalProfileIds: ['prof-1'],
};
const PATIENT: Account = {
  ...PROFESSIONAL,
  patientProfileId: 'patient-1',
  professionalProfileIds: [],
};
const ADMIN: Account = {
  ...PROFESSIONAL,
  role: 'admin',
  professionalProfileIds: [],
};

const note = (id: string, readAt: string | null = null) => ({
  id,
  type: 'review_window',
  message: `A reavaliação do PTS de ${id} vence em 30 dias (18/12/2026).`,
  ptsId: `pts-${id}`,
  createdAt: '2026-11-18T09:00:00.000Z',
  readAt,
});

function respond(status: number, body: unknown) {
  return {
    ok: status < 400,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('Notificações (RFNOT002)', () => {
  const replace = jest.fn();
  let notes: ReturnType<typeof note>[];
  let listResponse: (() => Response) | null;
  let totalPages: number;

  const calls = (part: string, method = 'GET') =>
    (global.fetch as jest.Mock).mock.calls.filter(
      ([url, init]) => url.includes(part) && (init?.method ?? 'GET') === method,
    );

  function open(account: Account) {
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      const unreadCount = notes.filter((item) => !item.readAt).length;

      if (url.endsWith('/me')) {
        return respond(200, account);
      }
      if (url.endsWith('/unread-count')) {
        return respond(200, { unreadCount });
      }
      if (init?.method === 'POST') {
        notes = notes.map((item) =>
          url.endsWith('/read-all') || url.includes(item.id)
            ? { ...item, readAt: '2026-11-19T10:00:00.000Z' }
            : item,
        );
        return respond(200, { status: 'OK' });
      }
      if (listResponse) {
        return listResponse();
      }
      const data = url.includes('unread=true')
        ? notes.filter((item) => !item.readAt)
        : notes;
      return respond(200, {
        data,
        pagination: { page: 1, limit: 10, total: data.length, totalPages },
        unreadCount,
      });
    }) as jest.Mock;

    render(<NotificationsPage />);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace });
    notes = [note('Livia'), note('Joao', '2026-11-19T10:00:00.000Z')];
    listResponse = null;
    totalPages = 1;
  });

  it('lista com o destaque da não lida e o link do PTS', async () => {
    open(PROFESSIONAL);

    const unread = (await screen.findByText(/PTS de Livia/)).closest(
      '.ux-note-item',
    ) as HTMLElement;
    const read = screen
      .getByText(/PTS de Joao/)
      .closest('.ux-note-item') as HTMLElement;

    expect(unread).toHaveClass('is-unread');
    expect(read).not.toHaveClass('is-unread');
    expect(
      within(unread).getByText('18/11/2026, 06:00 · não lida'),
    ).toBeInTheDocument();
    expect(within(unread).getByText('Reavaliação próxima')).toBeInTheDocument();
    expect(
      within(unread).getByRole('link', { name: 'Abrir PTS' }),
    ).toHaveAttribute('href', '/pts/pts-Livia');
    expect(screen.getByText('2 notificações')).toBeInTheDocument();
    expect(calls('/notifications?')[0]).toEqual([
      'http://localhost:3000/notifications?page=1&limit=10',
      expect.objectContaining({ credentials: 'include' }),
    ]);
  });

  it('leva o paciente ao Meu PTS', async () => {
    open(PATIENT);

    expect(
      (await screen.findAllByRole('link', { name: 'Ver meu PTS' }))[0],
    ).toHaveAttribute('href', '/pts');
    expect(
      screen.getAllByText('Sua reavaliação está próxima')[0],
    ).toBeInTheDocument();
  });

  it('marca como lida ao abrir, sem repetir na já lida', async () => {
    open(PROFESSIONAL);
    const [unread, read] = await screen.findAllByRole('link', {
      name: 'Abrir PTS',
    });

    unread.addEventListener('click', (event) => event.preventDefault());
    read.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(read);
    expect(calls('/read', 'POST')).toHaveLength(0);

    fireEvent.click(unread);
    await waitFor(() => expect(calls('/read', 'POST')).toHaveLength(1));
    expect(calls('/read', 'POST')[0][1]).toMatchObject({
      credentials: 'include',
      keepalive: true,
    });
    expect(
      await screen.findByRole('link', { name: 'Notificações: 0 não lidas' }),
    ).toBeInTheDocument();
  });

  it('filtra as não lidas, marca todas e mostra o vazio', async () => {
    open(PROFESSIONAL);
    await screen.findByText(/PTS de Joao/);

    fireEvent.click(screen.getByRole('button', { name: 'Não lidas' }));
    await waitFor(() =>
      expect(screen.queryByText(/PTS de Joao/)).not.toBeInTheDocument(),
    );
    expect(await screen.findByText(/PTS de Livia/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Não lidas' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      screen.getByRole('link', { name: 'Notificações: 1 não lida' }),
    ).toHaveAttribute('aria-current', 'page');

    fireEvent.click(
      screen.getByRole('button', { name: 'Marcar todas como lidas' }),
    );

    expect(
      await screen.findByText('Nenhuma notificação não lida'),
    ).toBeInTheDocument();
    expect(screen.getByText('Você está em dia.')).toBeInTheDocument();
    expect(calls('/read-all', 'POST')).toHaveLength(1);
    expect(
      await screen.findByRole('link', { name: 'Notificações: 0 não lidas' }),
    ).toBeInTheDocument();
  });

  it('sem não lidas, o "Marcar todas como lidas" fica desabilitado', async () => {
    notes = [note('Joao', '2026-11-19T10:00:00.000Z')];
    open(PROFESSIONAL);
    await screen.findByText(/PTS de Joao/);

    expect(
      screen.getByRole('button', { name: 'Marcar todas como lidas' }),
    ).toBeDisabled();
  });

  it('pagina', async () => {
    totalPages = 2;
    open(PROFESSIONAL);
    await screen.findByText(/PTS de Joao/);

    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }));

    await waitFor(() => expect(calls('page=2&limit=10')).toHaveLength(1));
  });

  it('mostra o erro e tenta de novo', async () => {
    listResponse = () => respond(500, { message: 'Falhou' });
    open(PROFESSIONAL);

    const retry = await screen.findByRole('button', {
      name: 'Tentar novamente',
    });
    listResponse = null;
    fireEvent.click(retry);

    expect(await screen.findByText(/PTS de Livia/)).toBeInTheDocument();
  });

  it('vai para o login sem sessão', async () => {
    listResponse = () => respond(401, {});
    open(PROFESSIONAL);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });

  it('o admin não recebe: sem sino nem consulta', async () => {
    open(ADMIN);

    expect(
      await screen.findByText('O administrador não recebe notificações'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /^Notificações/ }),
    ).not.toBeInTheDocument();
    expect(calls('/notifications')).toHaveLength(0);
  });
});
