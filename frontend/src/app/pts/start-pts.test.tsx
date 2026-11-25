import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useRouter } from 'next/navigation';

import type { Account } from '@/lib/account';
import { personalData } from '@/test-utils/account';

import PtsDetailPage from './[ptsId]/PtsDetail';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const RESPONSIBLE: Account = {
  accountId: 'professional-uuid',
  name: 'Ana Souza',
  email: 'ana@example.com',
  role: 'user',
  ...personalData,
  patientProfileId: null,
  professionalProfileIds: ['prof-1'],
};
const MEMBER: Account = { ...RESPONSIBLE, professionalProfileIds: ['prof-2'] };
const ADMIN: Account = {
  ...RESPONSIBLE,
  role: 'admin',
  professionalProfileIds: [],
};
const PATIENT: Account = {
  ...RESPONSIBLE,
  accountId: 'patient-1',
  patientProfileId: 'patient-1',
  professionalProfileIds: [],
};

const professional = (id: string, name: string) => ({
  id,
  name,
  specialism: { id: 'psychologist', name: 'Psicologia' },
  registration: null,
});

const PTS = {
  id: 'pts-1',
  status: 'planning',
  socialSituation: 'Mora com a mãe.',
  createdAt: '2026-11-05T13:00:00.000Z',
  acceptedAt: '2026-11-10T13:00:00.000Z',
  rejectedAt: null,
  beganAt: null,
  concludedAt: null,
  cancelledAt: null,
  patient: { id: 'patient-1', name: 'Diego Alves' },
  responsible: professional('prof-1', 'Ana Souza'),
  team: [professional('prof-2', 'Beatriz Lopes')],
};

const STARTED = {
  id: 'pts-1',
  status: 'running',
  beganAt: '2026-12-01T13:00:00.000Z',
};

function respond(status: number, data: unknown) {
  return {
    ok: status < 400,
    status,
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response;
}

const TIMELINE = {
  data: [],
  pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
};

function mockApi(
  account: Account,
  pts: unknown = PTS,
  start: () => Promise<Response> = () => Promise.resolve(respond(200, STARTED)),
) {
  global.fetch = jest.fn((url: string) => {
    if (url.endsWith('/start')) {
      return start();
    }

    return Promise.resolve(
      url.endsWith('/me')
        ? respond(200, account)
        : url.includes('/timeline')
          ? respond(200, TIMELINE)
          : respond(200, pts),
    );
  }) as jest.Mock;
}

const callsTo = (part: string) =>
  (global.fetch as jest.Mock).mock.calls.filter(([url]) =>
    (url as string).includes(part),
  );

async function renderPts() {
  render(<PtsDetailPage id="pts-1" />);
  await screen.findByRole('heading', { name: 'PTS de Diego Alves' });
}

const startButton = () =>
  screen.queryByRole('button', { name: 'Iniciar execução' });
// Link para a tela de reavaliação (RFEVA005).
const reassessButton = () =>
  screen.queryByRole('link', { name: 'Registrar reavaliação' });

function openDialog() {
  fireEvent.click(startButton()!);

  return within(screen.getByRole('dialog'));
}

describe('iniciar execução do PTS (RFPTS006)', () => {
  const replace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace });
    window.history.replaceState(null, '', '/pts/pts-1');
  });

  it.each([
    ['o responsável', RESPONSIBLE],
    ['o admin', ADMIN],
  ])(
    'mostra "Iniciar execução" para %s em planejamento',
    async (_, account) => {
      mockApi(account);
      await renderPts();

      expect(startButton()).toBeInTheDocument();
      expect(reassessButton()).not.toBeInTheDocument();
    },
  );

  it.each([
    ['membro da equipe', MEMBER],
    ['paciente', PATIENT],
  ])('não mostra para %s', async (_, account) => {
    mockApi(account);
    await renderPts();

    expect(startButton()).not.toBeInTheDocument();
  });

  it.each(['draft', 'running', 'concluded', 'cancelled', 'rejected'])(
    'não mostra com o PTS em %s, nem para o admin',
    async (status) => {
      mockApi(ADMIN, { ...PTS, status });
      await renderPts();

      expect(startButton()).not.toBeInTheDocument();
    },
  );

  it('abre a confirmação do mockup e cancela sem chamar a API', async () => {
    mockApi(RESPONSIBLE);
    await renderPts();

    const dialog = openDialog();

    expect(
      dialog.getByRole('heading', {
        name: 'Iniciar a execução do PTS de Diego Alves?',
      }),
    ).toBeInTheDocument();
    expect(
      dialog.getByText(
        'O PTS passa para Em andamento e a data de início é registrada na timeline.',
      ),
    ).toBeInTheDocument();

    fireEvent.click(dialog.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(callsTo('/start')).toHaveLength(0);
  });

  it('inicia, mostra "Em andamento" e o Início sem recarregar o PTS', async () => {
    let finish: (response: Response) => void = () => undefined;
    mockApi(
      RESPONSIBLE,
      PTS,
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await renderPts();
    const loads = callsTo('/pts/pts-1').length;

    const dialog = openDialog();
    fireEvent.click(dialog.getByRole('button', { name: 'Iniciar execução' }));

    const loading = dialog.getByRole('button', { name: 'Iniciando...' });
    expect(loading).toBeDisabled();
    expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    fireEvent.click(loading);

    expect(callsTo('/start')).toEqual([
      [
        'http://localhost:3000/pts/pts-1/start',
        { method: 'POST', credentials: 'include' },
      ],
    ]);

    await act(async () => finish(respond(200, STARTED)));

    expect(screen.getByText('Em andamento')).toBeInTheDocument();
    expect(screen.queryByText('Em planejamento')).not.toBeInTheDocument();
    expect(screen.getByText('01/12/2026')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(startButton()).not.toBeInTheDocument();
    expect(reassessButton()).toBeInTheDocument();
    expect(callsTo('/pts/pts-1')).toHaveLength(loads + 1);
  });

  it('mostra o Início no horário de Brasília, como a timeline', async () => {
    mockApi(RESPONSIBLE, {
      ...PTS,
      status: 'running',
      beganAt: '2026-12-02T01:30:00.000Z',
    });
    await renderPts();

    expect(screen.getByText('01/12/2026')).toBeInTheDocument();
  });

  it('recarrega a timeline aberta depois de iniciar', async () => {
    window.location.hash = '#timeline';
    mockApi(RESPONSIBLE);
    await renderPts();
    await waitFor(() => expect(callsTo('/timeline')).toHaveLength(1));

    const dialog = openDialog();
    fireEvent.click(dialog.getByRole('button', { name: 'Iniciar execução' }));

    await waitFor(() => expect(callsTo('/timeline')).toHaveLength(2));
  });

  it.each([
    [403, 'FORBIDDEN', 'Somente o responsável pode iniciar a execução do PTS.'],
    [404, 'PTS_NOT_FOUND', 'PTS não encontrado.'],
    [
      409,
      'PTS_NOT_PLANNING',
      'Só um PTS em planejamento pode ter a execução iniciada.',
    ],
  ])(
    'mostra no diálogo a mensagem da API no %s',
    async (status, code, message) => {
      mockApi(RESPONSIBLE, PTS, () =>
        Promise.resolve(respond(status, { status: code, message })),
      );
      await renderPts();

      const dialog = openDialog();
      fireEvent.click(dialog.getByRole('button', { name: 'Iniciar execução' }));

      expect(await dialog.findByRole('alert')).toHaveTextContent(message);
      expect(
        dialog.getByRole('button', { name: 'Iniciar execução' }),
      ).toBeEnabled();
      expect(screen.getByText('Em planejamento')).toBeInTheDocument();
    },
  );

  it('mostra uma mensagem padrão sem conexão', async () => {
    mockApi(RESPONSIBLE, PTS, () => Promise.reject(new TypeError('network')));
    await renderPts();

    const dialog = openDialog();
    fireEvent.click(dialog.getByRole('button', { name: 'Iniciar execução' }));

    expect(await dialog.findByRole('alert')).toHaveTextContent(
      'Não foi possível iniciar a execução do PTS',
    );
  });

  it('redireciona para o login no 401', async () => {
    mockApi(RESPONSIBLE, PTS, () => Promise.resolve(respond(401, {})));
    await renderPts();

    const dialog = openDialog();
    fireEvent.click(dialog.getByRole('button', { name: 'Iniciar execução' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });
});
