import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Account } from '@/lib/account';
import { personalData } from '@/test-utils/account';
import PtsProposalsPage from './page';

const mockReplace = jest.fn();
// O router do Next é estável entre renderizações.
const mockRouter = { replace: mockReplace, push: jest.fn() };
let mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
}));

const PATIENT_ID = '0b6f5a4e-2c1d-4e8f-9a7b-3c2d1e0f9a8b';
const PROFESSIONAL_ID = '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';

function account(overrides: Partial<Account>): Account {
  return {
    accountId: 'account-uuid',
    name: 'Conta Teste',
    email: 'conta@example.com',
    role: 'user',
    ...personalData,
    patientProfileId: null,
    professionalProfileIds: [],
    ...overrides,
  };
}

const proposal = {
  id: 'proposal-1',
  status: 'draft',
  socialSituation: 'Mora com a mãe.',
  createdAt: '2026-10-28T12:00:00.000Z',
  patient: { id: PATIENT_ID, name: 'Luna Ferreira' },
  responsible: {
    id: PROFESSIONAL_ID,
    name: 'Ana Souza',
    specialism: { id: 'psychologist', name: 'Psicólogo' },
  },
  team: [
    {
      id: 'pro-2',
      name: 'Beatriz Lopes',
      specialism: { id: 'nutritionist', name: 'Nutricionista' },
    },
  ],
};

function page(data: unknown[]) {
  return {
    data,
    pagination: { page: 1, limit: 10, total: data.length, totalPages: 1 },
  };
}

function json(status: number, body?: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

// /me responde a conta; /pts/proposals, as propostas; o POST de decisão, `decide`.
function mockApi(
  me: Account,
  proposals: unknown[] = [proposal],
  decide: { status: number; body?: unknown } = { status: 200, body: {} },
) {
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));

    if (url.pathname === '/me') return json(200, me);
    if (init?.method === 'POST') return json(decide.status, decide.body);

    return json(200, page(proposals));
  }) as jest.Mock;
}

function proposalsCalls() {
  return (global.fetch as jest.Mock).mock.calls
    .map(([input]) => new URL(String(input)))
    .filter((url) => url.pathname === '/pts/proposals');
}

beforeEach(() => {
  mockSearchParams = new URLSearchParams();
  mockReplace.mockReset();
});

describe('PtsProposalsPage para o profissional', () => {
  const professional = account({ professionalProfileIds: [PROFESSIONAL_ID] });

  it('lista as propostas na tabela, sem exigir paciente', async () => {
    mockApi(professional);

    render(<PtsProposalsPage />);

    const row = (await screen.findByText('Luna Ferreira')).closest('tr')!;

    expect(within(row).getByText('Em proposta')).toBeInTheDocument();
    expect(within(row).getByText('Ana Souza, Psicólogo')).toBeInTheDocument();
    expect(
      within(row).getByLabelText('Ana Souza, Psicólogo, responsável'),
    ).toHaveTextContent('AS');
    expect(within(row).getByText('28/10/2026')).toBeInTheDocument();
    expect(screen.getByText('1 proposta')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Criar proposta' }),
    ).toHaveAttribute('href', '/pts/novo');
    expect(proposalsCalls()[0].searchParams.get('patientId')).toBeNull();
    expect(proposalsCalls()[0].searchParams.get('limit')).toBe('10');
  });

  it('busca pelo nome do paciente da URL', async () => {
    mockSearchParams = new URLSearchParams('q=luna');
    mockApi(professional);

    render(<PtsProposalsPage />);

    await screen.findByText('Luna Ferreira');
    expect(proposalsCalls()[0].searchParams.get('q')).toBe('luna');
  });

  it('abre a proposta e leva o responsável à edição', async () => {
    mockApi(professional);

    render(<PtsProposalsPage />);

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Ações para proposta de Luna Ferreira',
      }),
    );
    expect(
      screen.getByRole('menuitem', { name: 'Editar proposta' }),
    ).toHaveAttribute('href', '/pts/proposals/proposal-1/edit');
    expect(
      screen.queryByRole('menuitem', { name: /em nome do paciente/ }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Ver proposta' }),
    );

    const dialog = screen.getByRole('dialog', {
      name: 'Proposta de Luna Ferreira',
    });
    expect(within(dialog).getByText('Mora com a mãe.')).toBeInTheDocument();
    expect(
      within(dialog).getByText('Beatriz Lopes, Nutricionista'),
    ).toBeInTheDocument();
  });

  it('mostra o estado vazio', async () => {
    mockApi(professional, []);

    render(<PtsProposalsPage />);

    expect(
      await screen.findByRole('heading', {
        name: 'Nenhuma proposta aguardando',
      }),
    ).toBeInTheDocument();
  });
});

describe('PtsProposalsPage para o admin', () => {
  it('aprova em nome do paciente e recarrega a lista', async () => {
    mockApi(account({ role: 'admin' }));

    render(<PtsProposalsPage />);

    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Ações para proposta de Luna Ferreira',
      }),
    );
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Aprovar em nome do paciente' }),
    );

    const dialog = screen.getByRole('dialog', {
      name: 'Aprovar a proposta em nome de Luna Ferreira?',
    });
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Aprovar proposta' }),
    );

    expect(
      await screen.findByText('Proposta aprovada. O PTS está em planejamento.'),
    ).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/pts/proposals/proposal-1/approve',
      expect.objectContaining({ method: 'POST' }),
    );
    await waitFor(() => expect(proposalsCalls()).toHaveLength(2));
  });
});

describe('PtsProposalsPage para o paciente', () => {
  const patient = account({ patientProfileId: PATIENT_ID });

  it('mostra a proposta com a equipe e rejeita', async () => {
    mockApi(patient, [{ ...proposal, socialSituation: undefined }]);

    render(<PtsProposalsPage />);

    expect(
      await screen.findByRole('heading', { name: 'Proposta de PTS para você' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Criada em 28/10/2026 por Ana Souza'),
    ).toBeInTheDocument();
    expect(screen.getByText('Psicólogo, responsável')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Criar proposta' }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Rejeitar proposta' }),
    );
    await userEvent.click(
      within(
        screen.getByRole('dialog', { name: 'Rejeitar a proposta?' }),
      ).getByRole('button', { name: 'Rejeitar proposta' }),
    );

    expect(await screen.findByText('Proposta rejeitada.')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Nenhuma proposta aguardando você' }),
    ).toBeInTheDocument();
  });

  it('mostra o erro da API na decisão e mantém o diálogo aberto', async () => {
    mockApi(patient, [proposal], {
      status: 409,
      body: { message: 'A proposta já foi decidida.' },
    });

    render(<PtsProposalsPage />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Aprovar proposta' }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Aprovar a proposta?' });
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Aprovar proposta' }),
    );

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'A proposta já foi decidida.',
    );
  });
});
