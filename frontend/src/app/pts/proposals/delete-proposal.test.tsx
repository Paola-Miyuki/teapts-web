import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import type { Account } from '@/lib/account';

import PtsProposalList from './_components/PtsProposalList';

const mockReplace = jest.fn();
// Mesmo objeto em todo render, como o useRouter do Next.
const mockRouter = { replace: mockReplace, push: jest.fn() };

let mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
}));

jest.mock('../novo/api/ptsApi', () => ({
  listProfessionals: jest.fn(() => Promise.resolve([])),
  listEligiblePatients: jest.fn(() => Promise.resolve([])),
  listAuthorizedPatients: jest.fn(() => Promise.resolve([])),
}));

const PROPOSAL_ID = '3f2e1d0c-9b8a-4765-a432-10fedcba9876';
const PATIENT_ID = '0b6f5a4e-2c1d-4e8f-9a7b-3c2d1e0f9a8b';
const RESPONSIBLE_ID = '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
const MEMBER_ID = '33333333-3333-4333-8333-333333333333';
const DELETE_URL = `http://localhost:3000/pts/proposals/${PROPOSAL_ID}`;

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

function professionalAccount(professionalId = RESPONSIBLE_ID): Account {
  return {
    accountId: '22222222-2222-4222-8222-222222222222',
    name: 'Profissional Teste',
    email: 'profissional@example.com',
    role: 'user',
    patientProfileId: null,
    professionalProfileIds: [professionalId],
  };
}

function patientAccount(): Account {
  return {
    accountId: '11111111-1111-4111-8111-111111111111',
    name: 'Paciente Teste',
    email: 'paciente@example.com',
    role: 'user',
    patientProfileId: PATIENT_ID,
    professionalProfileIds: [],
  };
}

function proposalsResponse(
  proposals: Array<Record<string, unknown>> = [proposal()],
) {
  return {
    data: proposals,
    pagination: {
      page: 1,
      limit: 20,
      total: proposals.length,
      totalPages: 1,
    },
  };
}

function proposal(overrides: Record<string, unknown> = {}) {
  return {
    id: PROPOSAL_ID,
    status: 'draft',
    socialSituation: 'Situação social de teste.',
    createdAt: '2026-10-15T12:00:00.000Z',
    patient: { id: PATIENT_ID, name: 'Paciente Teste' },
    responsible: {
      id: RESPONSIBLE_ID,
      name: 'Responsável Teste',
      specialism: { id: 'psychologist', name: 'Psicologia' },
    },
    team: [
      {
        id: MEMBER_ID,
        name: 'Integrante Teste',
        specialism: { id: 'doctor', name: 'Medicina' },
      },
    ],
    ...overrides,
  };
}

// Mostra a lista e abre o modal de "Excluir proposta".
async function openDeleteDialog() {
  render(<PtsProposalList account={professionalAccount()} />);

  fireEvent.click(
    await screen.findByRole('button', { name: 'Excluir proposta' }),
  );

  return screen.findByRole('dialog', { name: 'Excluir proposta?' });
}

describe('Excluir proposta de PTS (RFPTS008)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams({ patientId: PATIENT_ID });
    global.fetch = jest.fn();
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse(proposalsResponse()),
    );
  });

  it('mostra "Excluir proposta" para o responsável', async () => {
    render(<PtsProposalList account={professionalAccount()} />);

    expect(
      await screen.findByRole('button', { name: 'Excluir proposta' }),
    ).toBeInTheDocument();
  });

  it('não mostra o botão para outro profissional da equipe', async () => {
    render(<PtsProposalList account={professionalAccount(MEMBER_ID)} />);

    expect(await screen.findByText('Responsável Teste')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Excluir proposta' }),
    ).not.toBeInTheDocument();
  });

  it('não mostra o botão para o paciente', async () => {
    mockSearchParams = new URLSearchParams();

    render(<PtsProposalList account={patientAccount()} />);

    expect(await screen.findByText('Responsável Teste')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Excluir proposta' }),
    ).not.toBeInTheDocument();
  });

  it('não mostra o botão em proposta que não está em draft', async () => {
    (global.fetch as jest.Mock).mockReset();
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse(proposalsResponse([proposal({ status: 'rejected' })])),
    );

    render(<PtsProposalList account={professionalAccount()} />);

    expect(await screen.findByText('Responsável Teste')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Excluir proposta' }),
    ).not.toBeInTheDocument();
  });

  it('exclui, recarrega a lista e mostra "Proposta excluída."', async () => {
    (global.fetch as jest.Mock)
      .mockImplementationOnce(() => jsonResponse({ status: 'OK' }))
      .mockImplementationOnce(() => jsonResponse(proposalsResponse([])));

    const dialog = await openDeleteDialog();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }));

    expect(await screen.findByText('Proposta excluída.')).toBeInTheDocument();
    expect(
      await screen.findByText('Nenhuma proposta encontrada'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Responsável Teste')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: 'Excluir proposta?' }),
    ).not.toBeInTheDocument();

    expect(global.fetch).toHaveBeenNthCalledWith(2, DELETE_URL, {
      method: 'DELETE',
      credentials: 'include',
    });
    // Recarrega a página atual da lista.
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('"Cancelar" fecha o modal sem chamar a API', async () => {
    const dialog = await openDeleteDialog();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Excluir proposta?' }),
      ).not.toBeInTheDocument();
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('mostra o loading no botão e não permite clique duplo', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(
      () => new Promise(() => {}),
    );

    const dialog = await openDeleteDialog();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }));

    const deleting = await within(dialog).findByRole('button', {
      name: 'Excluindo...',
    });

    expect(deleting).toBeDisabled();
    expect(
      within(dialog).getByRole('button', { name: 'Cancelar' }),
    ).toBeDisabled();

    fireEvent.click(deleting);

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('exibe a mensagem da API no modal (409)', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse(
        {
          status: 'PTS_NOT_DRAFT',
          message: 'Somente propostas aguardando decisão podem ser excluídas.',
        },
        409,
      ),
    );

    const dialog = await openDeleteDialog();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }));

    expect(
      await within(dialog).findByText(
        'Somente propostas aguardando decisão podem ser excluídas.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('dialog', { name: 'Excluir proposta?' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Responsável Teste')).toBeInTheDocument();
  });

  it('redireciona para o login quando a sessão expira (401)', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse({ message: 'unauthorised' }, 401),
    );

    const dialog = await openDeleteDialog();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });
});
