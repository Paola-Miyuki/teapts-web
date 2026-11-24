import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Account } from '@/lib/account';
import { personalData } from '@/test-utils/account';
import PtsProposalsPage from './page';

const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace, push: jest.fn() };

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => new URLSearchParams(),
}));

const PROPOSAL_ID = '3f2e1d0c-9b8a-4765-a432-10fedcba9876';
const RESPONSIBLE_ID = '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
const DELETE_URL = `http://localhost:3000/pts/proposals/${PROPOSAL_ID}`;

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

function proposal(overrides: Record<string, unknown> = {}) {
  return {
    id: PROPOSAL_ID,
    status: 'draft',
    socialSituation: 'Situação social de teste.',
    createdAt: '2026-10-15T12:00:00.000Z',
    patient: { id: 'patient-1', name: 'Luna Ferreira' },
    responsible: {
      id: RESPONSIBLE_ID,
      name: 'Responsável Teste',
      specialism: { id: 'psychologist', name: 'Psicólogo' },
    },
    team: [],
    ...overrides,
  };
}

function json(status: number, body?: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

// `list` é a resposta de GET /pts/proposals a cada chamada, na ordem.
function mockApi(
  me: Account,
  lists: unknown[][],
  remove: { status: number; body?: unknown } = {
    status: 200,
    body: { status: 'OK' },
  },
) {
  let call = 0;

  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));

    if (url.pathname === '/me') return json(200, me);
    if (init?.method === 'DELETE') return json(remove.status, remove.body);

    const data = lists[Math.min(call++, lists.length - 1)];

    return json(200, {
      data,
      pagination: { page: 1, limit: 10, total: data.length, totalPages: 1 },
    });
  }) as jest.Mock;
}

const responsible = account({ professionalProfileIds: [RESPONSIBLE_ID] });

async function openDeleteDialog() {
  const user = userEvent.setup();

  render(<PtsProposalsPage />);
  await user.click(
    await screen.findByRole('button', {
      name: 'Ações para proposta de Luna Ferreira',
    }),
  );
  await user.click(screen.getByRole('menuitem', { name: 'Excluir proposta' }));

  return { user, dialog: within(await screen.findByRole('dialog')) };
}

describe('Excluir proposta de PTS (RFPTS008)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ['o responsável', responsible, 'draft'],
    ['o admin', account({ role: 'admin' }), 'draft'],
  ])('mostra "Excluir proposta" para %s', async (_who, me, status) => {
    mockApi(me, [[proposal({ status })]]);
    const user = userEvent.setup();

    render(<PtsProposalsPage />);
    await user.click(
      await screen.findByRole('button', {
        name: 'Ações para proposta de Luna Ferreira',
      }),
    );

    expect(
      screen.getByRole('menuitem', { name: 'Excluir proposta' }),
    ).toBeInTheDocument();
  });

  it('não mostra para outro profissional da equipe', async () => {
    mockApi(account({ professionalProfileIds: ['outro-profissional'] }), [
      [proposal()],
    ]);
    const user = userEvent.setup();

    render(<PtsProposalsPage />);
    await user.click(
      await screen.findByRole('button', {
        name: 'Ações para proposta de Luna Ferreira',
      }),
    );

    expect(
      screen.queryByRole('menuitem', { name: 'Excluir proposta' }),
    ).not.toBeInTheDocument();
  });

  it('confirma, exclui, recarrega a lista e mostra "Proposta excluída"', async () => {
    mockApi(responsible, [[proposal()], []]);

    const { user, dialog } = await openDeleteDialog();

    expect(
      dialog.getByRole('heading', {
        name: 'Excluir a proposta de Luna Ferreira?',
      }),
    ).toBeInTheDocument();
    expect(
      dialog.getByText(
        'A proposta sai das listagens. O registro fica guardado para auditoria.',
      ),
    ).toBeInTheDocument();

    await user.click(dialog.getByRole('button', { name: 'Excluir proposta' }));

    expect(await screen.findByText('Proposta excluída')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText('Luna Ferreira')).not.toBeInTheDocument(),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      DELETE_URL,
      expect.objectContaining({ method: 'DELETE', credentials: 'include' }),
    );
  });

  it('"Cancelar" fecha o diálogo sem chamar a API', async () => {
    mockApi(responsible, [[proposal()]]);

    const { user, dialog } = await openDeleteDialog();

    await user.click(dialog.getByRole('button', { name: 'Cancelar' }));

    expect(
      (global.fetch as jest.Mock).mock.calls.some(
        ([, init]) => init?.method === 'DELETE',
      ),
    ).toBe(false);
    expect(screen.getByText('Luna Ferreira')).toBeInTheDocument();
  });

  it('mostra a mensagem da API no diálogo (409) e mantém a proposta', async () => {
    mockApi(responsible, [[proposal()]], {
      status: 409,
      body: {
        status: 'PTS_NOT_DRAFT',
        message: 'Somente propostas aguardando decisão podem ser excluídas.',
      },
    });

    const { user, dialog } = await openDeleteDialog();

    await user.click(dialog.getByRole('button', { name: 'Excluir proposta' }));

    expect(await dialog.findByRole('alert')).toHaveTextContent(
      'Somente propostas aguardando decisão podem ser excluídas.',
    );
    expect(screen.getByText('Luna Ferreira')).toBeInTheDocument();
  });

  it('redireciona para o login quando a sessão expira (401)', async () => {
    mockApi(responsible, [[proposal()]], { status: 401, body: {} });

    const { user, dialog } = await openDeleteDialog();

    await user.click(dialog.getByRole('button', { name: 'Excluir proposta' }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
  });
});
