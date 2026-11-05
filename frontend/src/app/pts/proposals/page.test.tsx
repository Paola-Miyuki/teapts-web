import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PtsProposalList from './_components/PtsProposalList';
import PtsProposalsPage from './page';
import type { Account } from '@/lib/account';
import { listAuthorizedPatients } from '../novo/api/ptsApi';

const mockReplace = jest.fn();
const mockPush = jest.fn();

const mockRouter = {
  replace: mockReplace,
  push: mockPush,
};

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

const PATIENT_ID = '0b6f5a4e-2c1d-4e8f-9a7b-3c2d1e0f9a8b';
const PROFESSIONAL_ID = '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

// Asserção segura com "as unknown as Account" para evitar o "any"
function patientAccount(): Account {
  return {
    accountId: '11111111-1111-4111-8111-111111111111',
    name: 'Conta Teste',
    email: 'conta@example.com',
    role: 'user',
    patientProfileId: PATIENT_ID,
    professionalProfileIds: [],
  } as unknown as Account;
}

function professionalAccount(): Account {
  return {
    accountId: '22222222-2222-4222-8222-222222222222',
    name: 'Profissional Teste',
    email: 'profissional@example.com',
    role: 'user',
    patientProfileId: null,
    professionalProfileIds: [PROFESSIONAL_ID],
  } as unknown as Account;
}

function proposalResponse(page = 1, totalPages = 1) {
  return {
    data: [
      {
        id: '3f2e1d0c-9b8a-4765-a432-10fedcba9876',
        status: 'draft',
        socialSituation: 'Situação social de teste.',
        createdAt: '2026-10-15T12:00:00.000Z',
        patient: {
          id: PATIENT_ID,
          name: 'Paciente Teste',
        },
        responsible: {
          id: PROFESSIONAL_ID,
          name: 'Responsável Teste',
          specialism: {
            id: 'psychologist',
            name: 'Psicologia',
          },
        },
        team: [
          {
            id: '33333333-3333-4333-8333-333333333333',
            name: 'Integrante Teste',
            specialism: {
              id: 'doctor',
              name: 'Medicina',
            },
          },
        ],
      },
    ],
    pagination: {
      page,
      limit: 20,
      total: totalPages,
      totalPages,
    },
  };
}

describe('PtsProposalList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    global.fetch = jest.fn();
  });

  it('consulta as propostas do próprio paciente', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse(proposalResponse()),
    );

    // O "as any" foi removido da renderização
    render(<PtsProposalList account={patientAccount()} />);

    expect(await screen.findByText('Responsável Teste')).toBeInTheDocument();
    expect(screen.getByText('Paciente Teste')).toBeInTheDocument();
    expect(
      screen.queryByText('Situação social de teste.'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Integrante Teste')).toBeInTheDocument();

    expect(global.fetch).toHaveBeenCalledWith(
      `http://localhost:3000/pts/proposals?patientId=${PATIENT_ID}&page=1&limit=20`,
      { credentials: 'include' },
    );
  });

  it('usa o patientId da URL para o profissional', async () => {
    mockSearchParams = new URLSearchParams(`patientId=${PATIENT_ID}`);

    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse(proposalResponse()),
    );

    render(<PtsProposalList account={professionalAccount()} />);

    expect(await screen.findByText('Responsável Teste')).toBeInTheDocument();
    expect(screen.getByText('Situação social de teste.')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      `http://localhost:3000/pts/proposals?patientId=${PATIENT_ID}&page=1&limit=20`,
      { credentials: 'include' },
    );
  });

  it('orienta o profissional quando patientId não foi informado', async () => {
    render(<PtsProposalList account={professionalAccount()} />);

    expect(
      await screen.findByText('Nenhum paciente selecionado'),
    ).toBeInTheDocument();

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('redireciona para login quando a sessão não é válida (401 na API)', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse({ message: 'unauthorised' }, 401),
    );

    render(<PtsProposalList account={patientAccount()} />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  it('exibe a mensagem da API quando o acesso é proibido', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse(
        {
          status: 'FORBIDDEN',
          message: 'Você não tem acesso às propostas deste paciente.',
        },
        403,
      ),
    );

    render(<PtsProposalList account={patientAccount()} />);

    expect(
      await screen.findByText(
        'Você não tem acesso às propostas deste paciente.',
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    ).toBeInTheDocument();
  });

  it('consulta a próxima página', async () => {
    (global.fetch as jest.Mock)
      .mockImplementationOnce(() => jsonResponse(proposalResponse(1, 2)))
      .mockImplementationOnce(() => jsonResponse(proposalResponse(2, 2)));

    render(<PtsProposalList account={patientAccount()} />);

    const nextButton = await screen.findByRole('button', {
      name: 'Próxima',
    });

    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:3000/pts/proposals?patientId=${PATIENT_ID}&page=2&limit=20`,
        { credentials: 'include' },
      );
    });
  });

  it('não consulta propostas quando patientId da URL é inválido', async () => {
    mockSearchParams = new URLSearchParams('patientId=valor-invalido');

    render(<PtsProposalList account={professionalAccount()} />);

    expect(await screen.findByText('Paciente inválido')).toBeInTheDocument();

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('busca propostas quando encontra exatamente um paciente pelo nome', async () => {
    mockSearchParams = new URLSearchParams('search=Paciente%20Teste');

    jest
      .mocked(listAuthorizedPatients)
      .mockResolvedValueOnce([{ id: PATIENT_ID, name: 'Paciente Teste' }]);

    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse(proposalResponse()),
    );

    render(<PtsProposalList account={professionalAccount()} />);

    expect(await screen.findByText('Responsável Teste')).toBeInTheDocument();

    expect(global.fetch).toHaveBeenCalledWith(
      `http://localhost:3000/pts/proposals?patientId=${PATIENT_ID}&page=1&limit=20`,
      { credentials: 'include' },
    );
  });

  it('mostra uma mensagem quando nenhum paciente corresponde à busca', async () => {
    mockSearchParams = new URLSearchParams('search=Paciente%20Inexistente');

    jest
      .mocked(listAuthorizedPatients)
      .mockResolvedValueOnce([{ id: PATIENT_ID, name: 'Paciente Teste' }]);

    render(<PtsProposalList account={professionalAccount()} />);

    expect(
      await screen.findByText('Nenhum paciente encontrado'),
    ).toBeInTheDocument();

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('solicita um nome mais completo quando vários pacientes correspondem à busca', async () => {
    const secondPatientId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

    mockSearchParams = new URLSearchParams('search=Maria');

    jest.mocked(listAuthorizedPatients).mockResolvedValueOnce([
      { id: PATIENT_ID, name: 'Maria Silva' },
      { id: secondPatientId, name: 'Maria Souza' },
    ]);

    render(<PtsProposalList account={professionalAccount()} />);

    expect(
      await screen.findByText('Mais de um paciente encontrado'),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Digite um nome mais completo/i),
    ).toBeInTheDocument();

    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('PtsProposalsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    global.fetch = jest.fn((url: string) =>
      url.endsWith('/me')
        ? jsonResponse(patientAccount())
        : jsonResponse(proposalResponse()),
    ) as jest.Mock;
  });

  it('explica a escolha da proposta numa ajuda ao lado do título', async () => {
    const user = userEvent.setup();

    render(<PtsProposalsPage />);

    const help = await screen.findByRole('button', {
      name: 'Ajuda: Como funciona a escolha da proposta',
    });

    expect(help).toHaveAccessibleDescription(
      'Só uma proposta pode ser aceita por vez. Quando uma é aceita, as outras propostas pendentes são rejeitadas automaticamente.',
    );
    expect(screen.queryByText(/Uma equipe por vez/)).not.toBeInTheDocument();

    await user.click(help);

    expect(help).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('PtsProposalList decisão do paciente', () => {
  const PROPOSAL_ID = '3f2e1d0c-9b8a-4765-a432-10fedcba9876';

  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    global.fetch = jest.fn();
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse(proposalResponse()),
    );
  });

  async function openDecision(action: string) {
    render(<PtsProposalList account={patientAccount()} />);

    fireEvent.click(await screen.findByRole('button', { name: action }));

    return screen.getByRole('dialog');
  }

  it('não mostra as ações para o profissional', async () => {
    mockSearchParams = new URLSearchParams(`patientId=${PATIENT_ID}`);

    render(<PtsProposalList account={professionalAccount()} />);

    expect(await screen.findByText('Responsável Teste')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Escolher esta equipe' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Rejeitar' }),
    ).not.toBeInTheDocument();
  });

  it('aprova a proposta e leva para o PTS', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse({ id: PROPOSAL_ID, status: 'planning' }),
    );

    const dialog = await openDecision('Escolher esta equipe');

    expect(
      within(dialog).getByRole('heading', { name: 'Aceitar proposta?' }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Escolher esta equipe' }),
    );

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/pts'));
    expect(global.fetch).toHaveBeenLastCalledWith(
      `http://localhost:3000/pts/proposals/${PROPOSAL_ID}/approve`,
      { method: 'POST', credentials: 'include' },
    );
  });

  it('rejeita a proposta e tira o card da lista', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse({ id: PROPOSAL_ID, status: 'rejected' }),
    );

    const dialog = await openDecision('Rejeitar');

    expect(
      within(dialog).getByRole('heading', { name: 'Rejeitar proposta?' }),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Rejeitar' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Proposta rejeitada.',
    );
    expect(screen.queryByText('Responsável Teste')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenLastCalledWith(
      `http://localhost:3000/pts/proposals/${PROPOSAL_ID}/reject`,
      { method: 'POST', credentials: 'include' },
    );
  });

  it('desabilita a confirmação durante o envio', async () => {
    let resolveDecision: (response: Response) => void = () => undefined;
    (global.fetch as jest.Mock).mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveDecision = resolve;
        }),
    );

    const dialog = await openDecision('Rejeitar');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rejeitar' }));

    expect(
      await within(dialog).findByRole('button', { name: 'Enviando...' }),
    ).toBeDisabled();
    expect(
      within(dialog).getByRole('button', { name: 'Cancelar' }),
    ).toBeDisabled();

    resolveDecision({
      ok: true,
      status: 200,
      json: async () => ({ id: PROPOSAL_ID, status: 'rejected' }),
    } as Response);

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Proposta rejeitada.',
    );
  });

  it('mostra a mensagem da API e permite tentar de novo', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse(
        {
          status: 'PTS_NOT_DRAFT',
          message: 'A proposta não está mais aguardando decisão.',
        },
        409,
      ),
    );

    const dialog = await openDecision('Escolher esta equipe');
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Escolher esta equipe' }),
    );

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'A proposta não está mais aguardando decisão.',
    );
    expect(
      within(dialog).getByRole('button', { name: 'Escolher esta equipe' }),
    ).toBeEnabled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('redireciona para login quando a sessão expira na decisão', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse({}, 401),
    );

    const dialog = await openDecision('Rejeitar');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rejeitar' }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
  });
});
