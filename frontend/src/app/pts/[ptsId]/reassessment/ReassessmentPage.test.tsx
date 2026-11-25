import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import type { Account } from '@/lib/account';
import { personalData } from '@/test-utils/account';

import ReassessmentPage from './ReassessmentPage';

const mockReplace = jest.fn();
const mockPush = jest.fn();
// Mesmo objeto em todo render, como o useRouter do Next.
const mockRouter = { replace: mockReplace, push: mockPush };

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

const PTS_ID = '3f2c9a1e-7b4d-4c8e-9f1a-2b3c4d5e6f70';
const NEXT_ID = '8a9b0c1d-2e3f-4a5b-8c6d-7e8f9a0b1c2d';
const RESPONSIBLE_ID = '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
const MEMBER_ID = '33333333-3333-4333-8333-333333333333';
const API = 'http://localhost:3000';
const POST_URL = `${API}/pts/${PTS_ID}/reassessment`;

function respond(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function account(overrides: Partial<Account> = {}): Account {
  return {
    accountId: '22222222-2222-4222-8222-222222222222',
    name: 'Ana Souza',
    email: 'ana@example.com',
    role: 'user',
    ...personalData,
    patientProfileId: null,
    professionalProfileIds: [RESPONSIBLE_ID],
    ...overrides,
  };
}

const PTS = {
  id: PTS_ID,
  status: 'running',
  version: 2,
  nextReviewAt: '2026-12-03',
  createdAt: '2026-02-14T12:00:00.000Z',
  acceptedAt: null,
  rejectedAt: null,
  beganAt: '2026-03-01T12:00:00.000Z',
  concludedAt: null,
  cancelledAt: null,
  patient: { id: 'patient-1', name: 'Ana Clara Ribeiro' },
  responsible: {
    id: RESPONSIBLE_ID,
    name: 'Ana Souza',
    specialism: { id: 'psychologist', name: 'Psicólogo' },
    registration: null,
  },
  team: [
    {
      id: MEMBER_ID,
      name: 'João Lima',
      specialism: { id: 'speech_therapist', name: 'Fonoaudiólogo' },
      registration: null,
    },
  ],
};

const goal = (id: string, title: string, status = 'in_progress') => ({
  id,
  title,
  description: `Descrição de ${title}`,
  term: 'short',
  area: 'communication',
  measureCriterion: '5 pedidos por dia',
  targetDate: '2026-11-30',
  status,
  resultNote: null,
  origin: 'new',
  activitiesCount: 0,
  registeredBy: { id: 'acc-1', name: 'Ana Souza' },
  createdAt: '2026-02-14T12:00:00.000Z',
});

const GOALS = [
  goal('goal-1', 'Ampliar a comunicação'),
  goal('goal-2', 'Participar de grupos'),
  // Já com resultado: não entra na reavaliação.
  goal('goal-3', 'Meta antiga', 'achieved'),
];

let fetchMock: jest.Mock;

function mockApi(
  pts: Record<string, unknown> = PTS,
  post: Response | Promise<Response> = respond(200, {
    id: PTS_ID,
    status: 'concluded',
    reassessedAt: '2026-12-15',
    nextPtsId: NEXT_ID,
  }),
) {
  fetchMock = jest.fn((url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      return Promise.resolve(post);
    }

    return Promise.resolve(
      url.endsWith('/goals')
        ? respond(200, { data: GOALS })
        : respond(200, pts),
    );
  });
  global.fetch = fetchMock as unknown as typeof fetch;
}

const goalCard = (title: string) =>
  within(screen.getByRole('listitem', { name: title }));
const sentBody = () =>
  JSON.parse(fetchMock.mock.calls.find(([url]) => url === POST_URL)![1].body);

async function renderPage(currentAccount: Account = account()) {
  render(<ReassessmentPage ptsId={PTS_ID} account={currentAccount} />);
  await screen.findByRole('heading', { name: 'Resultado das metas' });
}

async function fillResults() {
  await renderPage();
  fireEvent.change(screen.getByLabelText(/^Data do encontro/), {
    target: { value: '2026-12-15' },
  });
  fireEvent.click(goalCard('Ampliar a comunicação').getByLabelText('Atingida'));
  fireEvent.click(
    goalCard('Participar de grupos').getByLabelText('Parcialmente atingida'),
  );
  fireEvent.change(
    goalCard('Participar de grupos').getByLabelText(/^Observação/),
    { target: { value: '  Conversa 2 vezes por semana.  ' } },
  );
  fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));
  await screen.findByRole('heading', { name: 'Encerrar o ciclo' });
}

describe('Registrar reavaliação (RFEVA005)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi();
  });

  it('mostra o resumo, as metas em andamento e quantas faltam', async () => {
    await renderPage();

    const summary = within(
      screen.getByRole('region', { name: 'PTS reavaliado' }),
    );
    expect(summary.getByText('Ana Clara Ribeiro')).toBeInTheDocument();
    expect(summary.getByText('PTS v2, em andamento')).toBeInTheDocument();
    expect(summary.getByText('Ana Souza, Psicólogo')).toBeInTheDocument();
    expect(summary.getByText('03/12/2026')).toBeInTheDocument();

    expect(
      screen.getByRole('listitem', { name: 'Participar de grupos' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Meta antiga')).not.toBeInTheDocument();
    expect(
      goalCard('Ampliar a comunicação').getByText('5 pedidos por dia'),
    ).toBeInTheDocument();

    const next = screen.getByRole('button', { name: /Próximo/ });
    expect(
      screen.getByText('Faltam 2 metas sem resultado.'),
    ).toBeInTheDocument();
    expect(next).toBeDisabled();

    fireEvent.click(
      goalCard('Ampliar a comunicação').getByLabelText('Atingida'),
    );
    expect(screen.getByText('Falta 1 meta sem resultado.')).toBeInTheDocument();
    expect(next).toBeDisabled();

    fireEvent.click(
      goalCard('Participar de grupos').getByLabelText('Não atingida'),
    );
    expect(screen.getByText('Todas as metas têm resultado.')).toHaveClass(
      'is-ok',
    );
    expect(next).toBeEnabled();
  });

  it('encerra criando a v3 e abre o rascunho', async () => {
    let finish: (value: Response) => void = () => undefined;
    mockApi(
      PTS,
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
    );
    await fillResults();

    expect(screen.getByText('Atingida')).toHaveClass('badge', 'done');
    expect(screen.getByText('Parcialmente atingida')).toHaveClass(
      'badge',
      'partial',
    );
    fireEvent.change(screen.getByLabelText(/^Motivo do encerramento/), {
      target: { value: 'Metas revistas.' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Encerrar e criar PTS v3' }),
    );

    const dialog = within(
      screen.getByRole('dialog', { name: 'Encerrar e criar o PTS v3?' }),
    );
    fireEvent.click(
      dialog.getByRole('button', { name: 'Encerrar e criar PTS v3' }),
    );

    expect(
      dialog.getByRole('button', { name: 'Encerrando...' }),
    ).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledWith(
      POST_URL,
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    expect(sentBody()).toEqual({
      meetingDate: '2026-12-15',
      goals: [
        { goalId: 'goal-1', status: 'achieved' },
        {
          goalId: 'goal-2',
          status: 'partially_achieved',
          note: 'Conversa 2 vezes por semana.',
        },
      ],
      createNextVersion: true,
      reason: 'Metas revistas.',
    });

    finish(
      respond(200, {
        id: PTS_ID,
        status: 'concluded',
        reassessedAt: '2026-12-15',
        nextPtsId: NEXT_ID,
      }),
    );

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(`/pts/proposals/${NEXT_ID}/edit`),
    );
  });

  it('encerra sem novo PTS e volta para o detalhe', async () => {
    mockApi(
      PTS,
      respond(200, {
        id: PTS_ID,
        status: 'concluded',
        reassessedAt: '2026-12-15',
        nextPtsId: null,
      }),
    );
    await fillResults();

    fireEvent.click(
      screen.getByRole('button', { name: 'Encerrar sem novo PTS' }),
    );
    fireEvent.click(
      within(
        screen.getByRole('dialog', { name: 'Encerrar sem novo PTS?' }),
      ).getByRole('button', { name: 'Encerrar sem novo PTS' }),
    );

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(`/pts/${PTS_ID}`),
    );
    expect(sentBody()).toMatchObject({ createNextVersion: false });
    expect(sentBody()).not.toHaveProperty('reason');
  });

  it('volta ao passo das metas sem perder o que foi marcado', async () => {
    await fillResults();

    fireEvent.click(screen.getByRole('button', { name: /Voltar/ }));

    expect(
      goalCard('Ampliar a comunicação').getByLabelText('Atingida'),
    ).toBeChecked();
    expect(
      screen.getByText('Todas as metas têm resultado.'),
    ).toBeInTheDocument();
  });

  it('mostra a mensagem da API quando o encerramento falha', async () => {
    const message = 'O paciente já possui uma proposta aguardando decisão.';
    mockApi(PTS, respond(409, { status: 'DRAFT_ALREADY_EXISTS', message }));
    await fillResults();

    fireEvent.click(
      screen.getByRole('button', { name: 'Encerrar e criar PTS v3' }),
    );
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Encerrar e criar PTS v3',
      }),
    );

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('vai para o login sem sessão', async () => {
    mockApi(PTS, respond(401, {}));
    await fillResults();

    fireEvent.click(
      screen.getByRole('button', { name: 'Encerrar sem novo PTS' }),
    );
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Encerrar sem novo PTS',
      }),
    );

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
  });

  it.each([
    ['o PTS fora de andamento', account(), { ...PTS, status: 'planning' }],
    [
      'um membro que não é o responsável',
      account({ professionalProfileIds: [MEMBER_ID] }),
      PTS,
    ],
  ])('não abre para %s', async (_name, currentAccount, pts) => {
    mockApi(pts);

    render(<ReassessmentPage ptsId={PTS_ID} account={currentAccount} />);

    expect(
      await screen.findByText(
        'A reavaliação só é registrada com o PTS em andamento, pelo responsável ou pelo administrador',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Voltar para o PTS' }),
    ).toHaveAttribute('href', `/pts/${PTS_ID}`);
  });

  it('o admin também registra', async () => {
    await renderPage(account({ role: 'admin', professionalProfileIds: [] }));

    expect(
      screen.getByRole('listitem', { name: 'Ampliar a comunicação' }),
    ).toBeInTheDocument();
  });
});
