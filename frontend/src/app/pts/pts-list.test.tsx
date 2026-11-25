import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Account } from '@/lib/account';
import { personalData } from '@/test-utils/account';
import PtsList from './_components/PtsList';

const mockReplace = jest.fn();
// O router do Next é estável entre renderizações.
const mockRouter = { replace: mockReplace, push: jest.fn() };
let mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
}));

const base: Account = {
  accountId: 'account-uuid',
  name: 'Conta Teste',
  email: 'conta@example.com',
  role: 'user',
  ...personalData,
  patientProfileId: null,
  professionalProfileIds: [],
};
const ADMIN: Account = { ...base, role: 'admin' };
const RESPONSIBLE: Account = { ...base, professionalProfileIds: ['prof-1'] };
const MEMBER: Account = { ...base, professionalProfileIds: ['prof-2'] };

const professional = (id: string, name: string, specialism = 'Psicólogo') => ({
  id,
  name,
  specialism: { id: 'psychologist', name: specialism },
});

function pts(overrides: Record<string, unknown>) {
  return {
    id: 'pts-1',
    status: 'running',
    version: 2,
    createdAt: '2026-02-14T12:00:00.000Z',
    beganAt: '2026-03-03T12:00:00.000Z',
    closedAt: null,
    patient: { id: 'patient-1', name: 'Ana Clara Ribeiro' },
    responsible: professional('prof-1', 'Ana Souza'),
    team: [
      professional('prof-2', 'João Lima', 'Fonoaudiólogo'),
      professional('prof-3', 'Renata Okada', 'Terapeuta ocupacional'),
      professional('prof-4', 'Camila Rocha', 'Assistente social'),
      professional('prof-5', 'Kaio Felipe', 'Médico'),
    ],
    ...overrides,
  };
}

const RUNNING = pts({});
const PLANNING = pts({
  id: 'pts-2',
  status: 'planning',
  version: 1,
  beganAt: null,
  patient: { id: 'patient-2', name: 'Diego Alves' },
  team: [],
});
const DRAFT = pts({
  id: 'pts-3',
  status: 'draft',
  version: 1,
  beganAt: null,
  patient: { id: 'patient-3', name: 'Luna Ferreira' },
  team: [professional('prof-2', 'João Lima', 'Fonoaudiólogo')],
});
const CONCLUDED = pts({
  id: 'pts-4',
  status: 'concluded',
  version: 1,
  beganAt: '2025-09-15T12:00:00.000Z',
  closedAt: '2026-08-30T12:00:00.000Z',
  patient: { id: 'patient-4', name: 'Carla Menezes' },
  team: [],
});

function list(data: unknown[], total = data.length) {
  return {
    data,
    pagination: { page: 1, limit: 10, total, totalPages: 1 },
  };
}

function json(status: number, body?: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

function ptsUrls() {
  return jest
    .mocked(global.fetch)
    .mock.calls.map(([url]) => new URL(String(url)))
    .filter((url) => url.pathname === '/pts');
}

function mockFetch(
  data: unknown[],
  extra?: (url: URL, init?: RequestInit) => Promise<Response> | undefined,
) {
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const custom = extra?.(url, init);

    if (custom) {
      return custom;
    }

    return json(200, list(data));
  }) as jest.Mock;
}

async function openMenu(
  user: ReturnType<typeof userEvent.setup>,
  patient: string,
) {
  await user.click(
    screen.getByRole('button', { name: `Ações para PTS de ${patient}` }),
  );
}

describe('PtsList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  it('lists the PTS with the columns of the layout', async () => {
    mockFetch([RUNNING, CONCLUDED, PLANNING]);

    render(<PtsList account={ADMIN} />);

    expect(
      await screen.findByRole('heading', {
        name: 'Projetos Terapêuticos Singulares',
      }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Ana Clara Ribeiro')).toBeInTheDocument();
    expect(screen.getByText('3 PTS')).toBeInTheDocument();
    expect(ptsUrls()[0].search).toBe('?page=1&limit=10');

    const running = screen.getByRole('row', { name: /Ana Clara Ribeiro/ });

    expect(within(running).getByText('Em andamento')).toBeInTheDocument();
    expect(within(running).getByText('2º PTS')).toBeInTheDocument();
    expect(
      within(running).getByText('Ana Souza, Psicólogo'),
    ).toBeInTheDocument();
    expect(within(running).getByText('14/02/2026')).toBeInTheDocument();
    expect(
      within(running).getByText('03/03/2026, em andamento'),
    ).toBeInTheDocument();
    // Até 3 avatares e o resto em "+N".
    expect(
      within(running).getByLabelText('Ana Souza, Psicólogo, responsável'),
    ).toBeInTheDocument();
    expect(
      within(running).getByLabelText(
        'Renata Okada, Terapeuta ocupacional, membro',
      ),
    ).toBeInTheDocument();
    expect(
      within(running).queryByLabelText(/Kaio Felipe, Médico, membro/),
    ).not.toBeInTheDocument();
    expect(
      within(running).getByLabelText('Mais 2: Camila Rocha, Kaio Felipe'),
    ).toHaveTextContent('+2');

    const concluded = screen.getByRole('row', { name: /Carla Menezes/ });

    expect(
      within(concluded).getByText('15/09/2025 até 30/08/2026'),
    ).toBeInTheDocument();

    const planning = screen.getByRole('row', { name: /Diego Alves/ });

    expect(
      within(planning).getByLabelText('Não informado', { selector: 'span' }),
    ).toBeInTheDocument();
  });

  it('offers the proposals and the create button, which only who can create sees', async () => {
    mockFetch([RUNNING]);

    const { rerender } = render(<PtsList account={RESPONSIBLE} />);

    expect(
      await screen.findByRole('link', { name: 'Propostas' }),
    ).toHaveAttribute('href', '/pts/proposals');
    expect(
      screen.getByRole('link', { name: 'Criar proposta de PTS' }),
    ).toHaveAttribute('href', '/pts/novo');

    rerender(<PtsList account={{ ...base, professionalProfileIds: [] }} />);
  });

  it('shows the actions by state for the responsible professional', async () => {
    const user = userEvent.setup();
    mockFetch([RUNNING, PLANNING, DRAFT, CONCLUDED]);

    render(<PtsList account={RESPONSIBLE} />);
    await screen.findByText('Ana Clara Ribeiro');

    await openMenu(user, 'Ana Clara Ribeiro');
    expect(
      screen.getByRole('menuitem', { name: 'Visualizar' }),
    ).toHaveAttribute('href', '/pts/pts-1');
    expect(
      screen.getByRole('menuitem', { name: 'Editar PTS' }),
    ).toHaveAttribute('href', '/pts/pts-1/edit');
    expect(
      screen.getByRole('menuitem', { name: 'Registrar reavaliação' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('menuitem', { name: 'Encerrar' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'Iniciar execução' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'Excluir' }),
    ).not.toBeInTheDocument();

    await openMenu(user, 'Diego Alves');
    expect(
      screen.getByRole('menuitem', { name: 'Iniciar execução' }),
    ).toBeInTheDocument();

    await openMenu(user, 'Luna Ferreira');
    expect(
      screen.getByRole('menuitem', { name: 'Editar proposta' }),
    ).toHaveAttribute('href', '/pts/proposals/pts-3/edit');
    expect(
      screen.getByRole('menuitem', { name: 'Excluir' }),
    ).toBeInTheDocument();

    await openMenu(user, 'Carla Menezes');
    const concluded = screen.getByRole('button', {
      name: 'Ações para PTS de Carla Menezes',
    });
    const menu = concluded.parentElement as HTMLElement;

    expect(within(menu).getAllByRole('menuitem')).toHaveLength(1);
  });

  it('gives a member only the actions of the team, not the responsible ones', async () => {
    const user = userEvent.setup();
    mockFetch([RUNNING]);

    render(<PtsList account={MEMBER} />);
    await screen.findByText('Ana Clara Ribeiro');
    await openMenu(user, 'Ana Clara Ribeiro');

    expect(
      screen.getByRole('menuitem', { name: 'Editar PTS' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'Encerrar' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'Registrar reavaliação' }),
    ).not.toBeInTheDocument();
  });

  it('starts the execution after the confirmation and reloads the list', async () => {
    const user = userEvent.setup();
    mockFetch([PLANNING], (url, init) =>
      url.pathname === '/pts/pts-2/start' && init?.method === 'POST'
        ? json(200, {
            id: 'pts-2',
            status: 'running',
            beganAt: '2026-11-25T12:00:00.000Z',
          })
        : undefined,
    );

    render(<PtsList account={RESPONSIBLE} />);
    await screen.findByText('Diego Alves');
    await openMenu(user, 'Diego Alves');
    await user.click(
      screen.getByRole('menuitem', { name: 'Iniciar execução' }),
    );

    const dialog = screen.getByRole('dialog');

    await user.click(
      within(dialog).getByRole('button', { name: 'Iniciar execução' }),
    );

    expect(
      await screen.findByText('Execução do PTS iniciada'),
    ).toBeInTheDocument();
    await waitFor(() => expect(ptsUrls()).toHaveLength(2));
  });

  it('deletes a proposal and reloads the list', async () => {
    const user = userEvent.setup();
    mockFetch([DRAFT], (url, init) =>
      url.pathname === '/pts/proposals/pts-3' && init?.method === 'DELETE'
        ? json(200, { id: 'pts-3' })
        : undefined,
    );

    render(<PtsList account={RESPONSIBLE} />);
    await screen.findByText('Luna Ferreira');
    await openMenu(user, 'Luna Ferreira');
    await user.click(screen.getByRole('menuitem', { name: 'Excluir' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: /Excluir proposta/,
      }),
    );

    expect(await screen.findByText('Proposta excluída')).toBeInTheDocument();
    await waitFor(() => expect(ptsUrls()).toHaveLength(2));
  });

  it('puts the filters in the URL and sends them to the API', async () => {
    const user = userEvent.setup();
    mockSearchParams = new URLSearchParams(
      'status=draft,running&sort=status&order=asc&created=custom&createdFrom=2026-10-01&createdTo=2026-11-23&member=prof-2',
    );
    mockFetch([RUNNING], (url) =>
      url.pathname === '/professionals'
        ? json(200, list([{ id: 'prof-2', name: 'João Lima' }]))
        : undefined,
    );

    render(<PtsList account={ADMIN} />);
    await screen.findByText('Ana Clara Ribeiro');

    expect(ptsUrls()[0].searchParams.get('status')).toBe('draft,running');
    expect(ptsUrls()[0].searchParams.get('sort')).toBe('status');
    expect(ptsUrls()[0].searchParams.get('order')).toBe('asc');
    expect(ptsUrls()[0].searchParams.get('createdFrom')).toBe('2026-10-01');
    expect(ptsUrls()[0].searchParams.get('createdTo')).toBe('2026-11-23');
    expect(ptsUrls()[0].searchParams.get('memberId')).toBe('prof-2');
    expect(screen.getByText('1 PTS com os filtros atuais')).toBeInTheDocument();

    expect(await screen.findByDisplayValue('João Lima')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Limpar' }));

    expect(mockReplace).toHaveBeenCalledWith('/pts?sort=status&order=asc', {
      scroll: false,
    });
  });

  it('offers "Sou responsável" only to the professional', async () => {
    const user = userEvent.setup();
    mockFetch([RUNNING]);

    const { unmount } = render(<PtsList account={RESPONSIBLE} />);
    await screen.findByText('Ana Clara Ribeiro');
    await user.click(screen.getByLabelText('Sou responsável'));

    expect(mockReplace).toHaveBeenCalledWith('/pts?responsible=prof-1', {
      scroll: false,
    });

    unmount();
    render(<PtsList account={ADMIN} />);
    await screen.findByText('Ana Clara Ribeiro');

    expect(screen.queryByLabelText('Sou responsável')).not.toBeInTheDocument();
  });

  it('changes the sort field and the direction', async () => {
    const user = userEvent.setup();
    mockFetch([RUNNING]);

    render(<PtsList account={ADMIN} />);
    await screen.findByText('Ana Clara Ribeiro');
    await user.selectOptions(screen.getByLabelText('Ordenar por'), 'status');

    expect(mockReplace).toHaveBeenLastCalledWith('/pts?sort=status', {
      scroll: false,
    });

    await user.click(screen.getByRole('button', { name: 'Ordem decrescente' }));

    expect(mockReplace).toHaveBeenLastCalledWith('/pts?order=asc', {
      scroll: false,
    });
  });

  it('shows the empty state, with and without filters', async () => {
    mockFetch([]);

    const { unmount } = render(<PtsList account={ADMIN} />);

    expect(await screen.findByText('Nenhum PTS')).toBeInTheDocument();

    unmount();
    mockSearchParams = new URLSearchParams('status=draft');
    render(<PtsList account={ADMIN} />);

    expect(
      await screen.findByText('Nenhum PTS encontrado'),
    ).toBeInTheDocument();
  });

  it('shows the API message on an error and retries', async () => {
    const user = userEvent.setup();
    global.fetch = jest
      .fn()
      .mockImplementationOnce(() =>
        json(403, {
          status: 'FORBIDDEN',
          message: 'Você não tem acesso a este PTS.',
        }),
      )
      .mockImplementation(() => json(200, list([RUNNING])));

    render(<PtsList account={ADMIN} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Você não tem acesso a este PTS.',
    );

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('Ana Clara Ribeiro')).toBeInTheDocument();
  });

  it('goes to the login on a 401', async () => {
    global.fetch = jest.fn(() => json(401, {})) as jest.Mock;

    render(<PtsList account={ADMIN} />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
  });
});
