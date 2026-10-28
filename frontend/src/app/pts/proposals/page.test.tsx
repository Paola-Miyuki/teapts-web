import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PtsProposalList from './_components/PtsProposalList';
import type { Account } from '@/lib/account';
import { listEligiblePatients } from '../novo/api/ptsApi';

const mockReplace = jest.fn();

const mockRouter = {
  replace: mockReplace,
};

let mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
}));

jest.mock('../novo/api/ptsApi', () => ({
  listProfessionals: jest.fn(() => Promise.resolve([])),
  listEligiblePatients: jest.fn(() => Promise.resolve([])),
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
    expect(screen.getByText('Situação social de teste.')).toBeInTheDocument();
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
      .mocked(listEligiblePatients)
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
      .mocked(listEligiblePatients)
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

    jest.mocked(listEligiblePatients).mockResolvedValueOnce([
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
