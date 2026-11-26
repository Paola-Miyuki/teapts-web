import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Account } from '@/lib/account';
import { personalData } from '@/test-utils/account';
import ActivePtsScreen from './_components/ActivePtsScreen';

// A Timeline e o histórico têm os próprios testes.
jest.mock('@/components/pts/TimelineTab', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/pts/PtsHistoryTab', () => ({
  __esModule: true,
  default: () => <p>Histórico simulado</p>,
}));

const mockRouter = { replace: jest.fn(), push: jest.fn() };

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

const PATIENT_ID = '0b6f5a4e-2c1d-4e8f-9a7b-3c2d1e0f9a8b';
const PROFESSIONAL_ID = '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';

const patient: Account = {
  accountId: 'account-uuid',
  name: 'Luna Ferreira',
  email: 'luna@example.com',
  role: 'user',
  ...personalData,
  patientProfileId: PATIENT_ID,
  professionalProfileIds: [],
};

const proposal = {
  id: 'proposal-1',
  status: 'draft',
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

function json(status: number, body?: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

// /me, o PTS ativo (sem PTS), as propostas e o POST de decisão.
function mockApi(
  proposals: unknown[] = [proposal],
  decide: { status: number; body?: unknown } = { status: 200, body: {} },
) {
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));

    if (url.pathname === '/me') return json(200, patient);
    if (url.pathname === '/pts/active') {
      return json(404, { status: 'ACTIVE_PTS_NOT_FOUND' });
    }
    if (init?.method === 'POST') return json(decide.status, decide.body);

    return json(200, {
      data: proposals,
      pagination: {
        page: 1,
        limit: 50,
        total: proposals.length,
        totalPages: 1,
      },
    });
  }) as jest.Mock;
}

async function openProposalsTab() {
  const tabs = await screen.findByRole('navigation', {
    name: 'Seções do PTS',
  });

  await userEvent.click(within(tabs).getByText('Propostas de PTS'));
}

beforeEach(() => {
  window.location.hash = '';
});

describe('abas do PTS do paciente', () => {
  it('mostra Meu PTS, Propostas de PTS e Histórico de PTS', async () => {
    mockApi();

    render(<ActivePtsScreen currentHref="/pts" />);

    const tabs = await screen.findByRole('navigation', {
      name: 'Seções do PTS',
    });

    expect(
      within(tabs)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Meu PTS', 'Propostas de PTS', 'Histórico de PTS']);
    expect(within(tabs).getByText('Meu PTS')).toHaveAttribute(
      'aria-current',
      'page',
    );

    await userEvent.click(within(tabs).getByText('Histórico de PTS'));

    expect(await screen.findByText('Histórico simulado')).toBeInTheDocument();
  });

  it('mostra a proposta com a equipe e rejeita', async () => {
    mockApi();

    render(<ActivePtsScreen currentHref="/pts" />);
    await openProposalsTab();

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

    expect(await screen.findByText('Proposta rejeitada')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Nenhuma proposta aguardando você' }),
    ).toBeInTheDocument();
  });

  it('mostra o erro da API na decisão e mantém o diálogo aberto', async () => {
    mockApi([proposal], {
      status: 409,
      body: { message: 'A proposta já foi decidida.' },
    });

    render(<ActivePtsScreen currentHref="/pts" />);
    await openProposalsTab();

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

  it('abre a aba de propostas por /pts#propostas', async () => {
    window.location.hash = '#propostas';
    mockApi();

    render(<ActivePtsScreen currentHref="/pts" />);

    expect(
      await screen.findByRole('heading', { name: 'Proposta de PTS para você' }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText('Propostas de PTS')).toHaveAttribute(
        'aria-current',
        'page',
      ),
    );
  });
});
