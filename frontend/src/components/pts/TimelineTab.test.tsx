import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import { useRouter } from 'next/navigation';

import type { TimelineRecord } from '@/lib/timeline';

import TimelineTab from './TimelineTab';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const AUTHORS = [
  { id: 'prof-1', name: 'Ana Souza' },
  { id: 'prof-2', name: 'João Lima' },
];

const RECORDS: TimelineRecord[] = [
  {
    id: 'rec-1',
    type: 'appointment_registered',
    targetType: 'appointment',
    targetId: 'app-1',
    description: 'João Lima registrou um atendimento em Integração sensorial',
    happenedAt: '2026-11-12T17:45:00.000Z',
    author: { id: 'acc-2', name: 'João Lima' },
    assignedTo: null,
  },
  {
    id: 'rec-2',
    type: 'document_uploaded',
    targetType: 'document',
    targetId: 'doc-1',
    description: 'Kaio enviou o documento Laudo neurológico',
    happenedAt: '2026-11-11T20:03:00.000Z',
    author: { id: 'acc-admin', name: 'Kaio Segunda Conta' },
    assignedTo: { id: 'prof-1', name: 'Ana Souza' },
  },
  {
    id: 'rec-3',
    type: 'goal_added',
    targetType: 'pts',
    targetId: 'pts-1',
    description: 'Ana Souza adicionou a meta Reduzir as crises no recreio',
    happenedAt: '2026-11-11T12:20:00.000Z',
    author: { id: 'acc-1', name: 'Ana Souza' },
    assignedTo: null,
  },
  {
    id: 'rec-4',
    type: 'member_removed',
    targetType: 'team_member',
    targetId: 'prof-9',
    description: 'Ana Souza removeu Marcos Vieira da equipe',
    happenedAt: '2026-11-11T11:00:00.000Z',
    author: { id: 'acc-1', name: 'Ana Souza' },
    assignedTo: null,
  },
];

function page(data: TimelineRecord[], overrides = {}) {
  return {
    data,
    pagination: {
      page: 1,
      limit: 10,
      total: data.length,
      totalPages: 1,
      ...overrides,
    },
  };
}

function respond(status: number, body: unknown) {
  return {
    ok: status < 400,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function mockFetch(...responses: Response[]) {
  const queue = [...responses];
  const fetchMock = jest.fn((url: string) =>
    Promise.resolve(
      url.includes('/professionals')
        ? respond(200, {
            data: AUTHORS,
            pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
          })
        : queue.length > 1
          ? queue.shift()!
          : queue[0],
    ),
  );
  global.fetch = fetchMock as unknown as typeof fetch;

  return fetchMock;
}

function timelineCalls(fetchMock: jest.Mock) {
  return fetchMock.mock.calls.filter(([url]) =>
    String(url).includes('/timeline'),
  );
}

function lastUrl(fetchMock: jest.Mock) {
  const calls = timelineCalls(fetchMock);

  return new URL(calls[calls.length - 1][0]);
}

function renderTab(isPatient = false) {
  return render(
    <TimelineTab
      ptsId="pts-1"
      patientId="patient-1"
      team={AUTHORS}
      isPatient={isPatient}
    />,
  );
}

describe('TimelineTab', () => {
  const replace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace });
    window.history.replaceState(null, '', '/pts/pts-1');
  });

  it('mostra o carregamento e depois os eventos agrupados por dia', async () => {
    const fetchMock = mockFetch(respond(200, page(RECORDS)));

    renderTab();

    expect(screen.getByText('Carregando timeline...')).toBeInTheDocument();
    expect(await screen.findByText('4 eventos')).toBeInTheDocument();

    const url = lastUrl(fetchMock);
    expect(url.pathname).toBe('/pts/pts-1/timeline');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: '1',
      limit: '10',
    });

    const groups = screen
      .getAllByRole('row')
      .filter((row) => row.classList.contains('group-row'))
      .map((row) => row.textContent);
    expect(groups).toEqual(['12/11/2026', '11/11/2026']);
  });

  it('mostra hora, autor, "Atribuído a", tipo e descrição de cada evento', async () => {
    mockFetch(respond(200, page(RECORDS)));

    renderTab();

    const event = (
      await screen.findByText('Kaio enviou o documento Laudo neurológico')
    ).closest('article')!;
    const facts = within(event);

    expect(facts.getByText('17:03')).toBeInTheDocument();
    expect(facts.getByText('Kaio Segunda Conta')).toBeInTheDocument();
    expect(facts.getByText('Atribuído a')).toBeInTheDocument();
    expect(facts.getByText('Ana Souza')).toBeInTheDocument();
    expect(facts.getByText('Documento')).toBeInTheDocument();

    const appointment = screen
      .getByText(/registrou um atendimento/)
      .closest('article')!;
    expect(within(appointment).getByText('14:45')).toBeInTheDocument();
    expect(
      within(appointment).queryByText('Atribuído a'),
    ).not.toBeInTheDocument();
  });

  it('mostra os links de atendimento, meta e documento para a equipe', async () => {
    mockFetch(respond(200, page(RECORDS)));

    renderTab();

    expect(
      await screen.findByRole('link', { name: 'Ver atendimento' }),
    ).toHaveAttribute('href', '#atendimentos');
    expect(screen.getByRole('link', { name: 'Ver meta' })).toHaveAttribute(
      'href',
      '#metas',
    );
    expect(screen.getByRole('link', { name: 'Ver documento' })).toHaveAttribute(
      'href',
      '/patients/patient-1#documentos',
    );
    const removal = screen
      .getByText(/removeu Marcos Vieira/)
      .closest('article')!;
    expect(within(removal).queryByRole('link')).not.toBeInTheDocument();
  });

  it('não mostra ao paciente o link dos eventos de documento', async () => {
    mockFetch(
      respond(
        200,
        page(
          RECORDS.map((record) =>
            record.targetType === 'document'
              ? { ...record, targetId: null }
              : record,
          ),
        ),
      ),
    );

    renderTab(true);

    expect(
      await screen.findByText('Kaio enviou o documento Laudo neurológico'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Ver documento' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Ver atendimento' }),
    ).toBeInTheDocument();
  });

  it('busca depois do debounce e volta à primeira página', async () => {
    jest.useFakeTimers();
    try {
      const fetchMock = mockFetch(respond(200, page(RECORDS)));

      renderTab();
      await screen.findByText('4 eventos');

      fireEvent.change(
        screen.getByPlaceholderText('Descrição ou autor do evento'),
        { target: { value: 'atendimento' } },
      );
      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() =>
        expect(lastUrl(fetchMock).searchParams.get('q')).toBe('atendimento'),
      );
      expect(lastUrl(fetchMock).searchParams.get('page')).toBe('1');
    } finally {
      jest.useRealTimers();
    }
  });

  it('filtra por tipo e autor', async () => {
    const fetchMock = mockFetch(respond(200, page(RECORDS)));

    renderTab();
    await screen.findByText('4 eventos');

    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Atividade' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Documento' }));

    await waitFor(() =>
      expect(lastUrl(fetchMock).searchParams.get('type')).toBe(
        'activity,document',
      ),
    );

    const author = screen.getByPlaceholderText('Quem executou');
    fireEvent.change(author, { target: { value: 'Ana' } });
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) =>
          String(url).includes('/professionals?'),
        ),
      ).toBe(true),
    );
    await act(async () => undefined);
    fireEvent.change(author, { target: { value: 'Ana Souza' } });

    await waitFor(() =>
      expect(lastUrl(fetchMock).searchParams.get('authorId')).toBe('prof-1'),
    );
    expect(
      await screen.findByText('4 eventos com os filtros atuais'),
    ).toBeInTheDocument();
  });

  it('filtra pelo período personalizado', async () => {
    const fetchMock = mockFetch(respond(200, page(RECORDS)));

    renderTab();
    await screen.findByText('4 eventos');

    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    fireEvent.change(screen.getByLabelText('Período'), {
      target: { value: 'custom' },
    });
    fireEvent.change(screen.getByLabelText('De'), {
      target: { value: '2026-11-01' },
    });
    fireEvent.change(screen.getByLabelText('Até'), {
      target: { value: '2026-11-15' },
    });

    await waitFor(() => {
      const params = lastUrl(fetchMock).searchParams;
      expect(params.get('from')).toBe('2026-11-01');
      expect(params.get('to')).toBe('2026-11-15');
    });
  });

  it('pagina a lista', async () => {
    const fetchMock = mockFetch(
      respond(200, page(RECORDS, { total: 14, totalPages: 2 })),
    );

    renderTab();
    expect(await screen.findByText('Mostrando 1–10 de 14')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Página 2' }));

    await waitFor(() =>
      expect(lastUrl(fetchMock).searchParams.get('page')).toBe('2'),
    );

    fireEvent.change(screen.getByLabelText('Itens por página'), {
      target: { value: '25' },
    });

    await waitFor(() => {
      const params = lastUrl(fetchMock).searchParams;
      expect(params.get('limit')).toBe('25');
      expect(params.get('page')).toBe('1');
    });
  });

  it('mostra a lista vazia', async () => {
    mockFetch(respond(200, page([])));

    renderTab();

    expect(
      await screen.findByRole('heading', { name: 'Nenhum evento registrado' }),
    ).toBeInTheDocument();
    expect(screen.getByText('0 eventos')).toBeInTheDocument();
  });

  it('diferencia a busca sem resultado da lista vazia', async () => {
    const fetchMock = mockFetch(
      respond(200, page(RECORDS)),
      respond(200, page([])),
    );

    renderTab();
    await screen.findByText('4 eventos');

    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Equipe' }));

    expect(
      await screen.findByRole('heading', { name: 'Nenhum evento' }),
    ).toBeInTheDocument();
    expect(timelineCalls(fetchMock)).toHaveLength(2);
  });

  it('mostra o erro da API e tenta de novo', async () => {
    const fetchMock = mockFetch(
      respond(403, {
        status: 'FORBIDDEN',
        message: 'Você não tem acesso à timeline deste PTS.',
      }),
      respond(200, page(RECORDS)),
    );

    renderTab();

    expect(
      await screen.findByRole('heading', {
        name: 'Não foi possível carregar a timeline',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Você não tem acesso à timeline deste PTS.'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('4 eventos')).toBeInTheDocument();
    expect(timelineCalls(fetchMock)).toHaveLength(2);
  });

  it('inverte a ordem para a mais antiga primeiro', async () => {
    const fetchMock = mockFetch(respond(200, page(RECORDS)));

    renderTab();
    await screen.findByText('4 eventos');

    fireEvent.click(screen.getByRole('button', { name: 'Ordem decrescente' }));

    await waitFor(() =>
      expect(lastUrl(fetchMock).searchParams.get('order')).toBe('asc'),
    );
    expect(window.location.search).toBe('?order=asc');
  });

  it('grava a busca e os filtros na URL, na aba Timeline', async () => {
    mockFetch(respond(200, page(RECORDS)));

    renderTab();
    await screen.findByText('4 eventos');

    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Documento' }));
    fireEvent.change(screen.getByLabelText('Período'), {
      target: { value: '90' },
    });

    await waitFor(() =>
      expect(window.location.search).toBe('?type=document&period=90'),
    );
    expect(window.location.hash).toBe('#timeline');
  });

  it('abre com a busca, os filtros, a ordem e a página da URL', async () => {
    window.history.replaceState(
      null,
      '',
      '/pts/pts-1?q=laudo&type=document,goal&period=custom&from=2026-11-01&to=2026-11-15&order=asc&page=2&limit=25#timeline',
    );
    const fetchMock = mockFetch(respond(200, page(RECORDS)));

    renderTab();
    await screen.findByText('4 eventos com os filtros atuais');

    expect(Object.fromEntries(lastUrl(fetchMock).searchParams)).toEqual({
      page: '2',
      limit: '25',
      q: 'laudo',
      type: 'document',
      from: '2026-11-01',
      to: '2026-11-15',
      order: 'asc',
    });
    expect(
      screen.getByPlaceholderText('Descrição ou autor do evento'),
    ).toHaveValue('laudo');
  });

  it('redireciona para o login sem sessão', async () => {
    mockFetch(respond(401, { message: 'unauthorised' }));

    renderTab();

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });
});
