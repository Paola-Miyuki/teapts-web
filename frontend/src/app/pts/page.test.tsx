import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Account } from '@/lib/account';
import { personalData } from '@/test-utils/account';

import PtsOverview from './_components/PtsOverview';

// A Timeline tem os próprios testes; aqui o fetch simulado é só o da equipe.
jest.mock('@/components/pts/TimelineTab', () => ({
  __esModule: true,
  default: () => null,
}));

const mockReplace = jest.fn();
// Mesmo objeto em todo render, como o useRouter do Next. Um objeto novo a
// cada render faria o useEffect do PtsOverview rodar de novo sem parar.
const mockRouter = { replace: mockReplace, push: jest.fn() };

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

const PATIENT_ID = '0b6f5a4e-2c1d-4e8f-9a7b-3c2d1e0f9a8b';
const PROFESSIONAL_ID = '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
const ACTIVE_URL = `http://localhost:3000/pts/active?patientId=${PATIENT_ID}`;

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

function patientAccount(): Account {
  return {
    accountId: '11111111-1111-4111-8111-111111111111',
    name: 'Priscila Martins',
    email: 'paciente@example.com',
    role: 'user',
    ...personalData,
    patientProfileId: PATIENT_ID,
    professionalProfileIds: [],
  };
}

function professionalAccount(): Account {
  return {
    accountId: '22222222-2222-4222-8222-222222222222',
    name: 'Kaio Segunda Conta',
    email: 'profissional@example.com',
    role: 'user',
    ...personalData,
    patientProfileId: null,
    professionalProfileIds: [PROFESSIONAL_ID],
  };
}

function activePts(overrides: Record<string, unknown> = {}) {
  return {
    id: '3f2e1d0c-9b8a-4765-a432-10fedcba9876',
    status: 'planning',
    socialSituation: 'Mora com a mãe e frequenta a escola municipal.',
    caseStudyDate: '2026-10-01',
    diagnosisSummary: 'Diagnóstico em comum da equipe.',
    cid: 'F84.0',
    supportLevel: 2,
    strengths: null,
    priorityNeeds: ['Comunicação funcional'],
    vulnerabilities: null,
    comorbidities: null,
    sensoryProfile: null,
    communicationMethod: null,
    nextReviewAt: '2027-10-01',
    createdAt: '2026-10-15T12:00:00.000Z',
    acceptedAt: '2026-10-15T12:30:00.000Z',
    beganAt: null,
    patient: { id: PATIENT_ID, name: 'Priscila Martins' },
    responsible: {
      id: PROFESSIONAL_ID,
      name: 'Kaio Segunda Conta',
      specialism: { id: 'psychologist', name: 'Psicologia' },
    },
    team: [
      {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Integrante Teste',
        specialism: { id: 'doctor', name: 'Medicina' },
      },
    ],
    ...overrides,
  };
}

describe('PtsOverview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('mostra o PTS ativo do próprio paciente sem a ficha', async () => {
    // A API omite a ficha (menos a próxima revisão) para o próprio paciente.
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse(
        activePts({
          socialSituation: undefined,
          caseStudyDate: undefined,
          diagnosisSummary: undefined,
          cid: undefined,
          supportLevel: undefined,
          strengths: undefined,
          priorityNeeds: undefined,
          vulnerabilities: undefined,
          comorbidities: undefined,
          sensoryProfile: undefined,
          communicationMethod: undefined,
        }),
      ),
    );

    render(<PtsOverview account={patientAccount()} patientId={PATIENT_ID} />);

    expect(await screen.findByText('Sobre este plano')).toBeInTheDocument();
    expect(screen.getAllByText('Priscila Martins')).not.toHaveLength(0);
    expect(screen.getAllByText('Em planejamento')).not.toHaveLength(0);
    expect(screen.getByText('Integrante Teste')).toBeInTheDocument();
    expect(screen.getByText('15/10/2026')).toBeInTheDocument();
    expect(screen.queryByText('Situação social')).not.toBeInTheDocument();
    expect(screen.queryByText('Diagnóstico')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Editar PTS' }),
    ).not.toBeInTheDocument();

    expect(global.fetch).toHaveBeenCalledWith(ACTIVE_URL, {
      credentials: 'include',
    });
  });

  it('mostra os cartões da ficha e o botão Editar PTS para o profissional da equipe', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse(activePts({ status: 'RUNNING' })),
    );

    render(
      <PtsOverview account={professionalAccount()} patientId={PATIENT_ID} />,
    );

    expect(await screen.findByText('Situação social')).toBeInTheDocument();
    expect(screen.getByText('Diagnóstico')).toBeInTheDocument();
    expect(screen.getByText('Perfil de neurodivergência')).toBeInTheDocument();
    expect(
      screen.getByText('Diagnóstico em comum da equipe.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Comunicação funcional')).toBeInTheDocument();
    expect(
      screen.getByText('Mora com a mãe e frequenta a escola municipal.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Editar PTS' })).toHaveAttribute(
      'href',
      '/pts/3f2e1d0c-9b8a-4765-a432-10fedcba9876/edit',
    );
    expect(screen.getAllByText('Em andamento')).not.toHaveLength(0);
    expect(screen.getByText(/· responsável/)).toBeInTheDocument();
  });

  it('mostra "Nenhum PTS ativo" com link para as propostas (paciente)', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse(
        {
          status: 'ACTIVE_PTS_NOT_FOUND',
          message: 'O paciente não possui PTS ativo.',
        },
        404,
      ),
    );

    render(<PtsOverview account={patientAccount()} patientId={PATIENT_ID} />);

    expect(await screen.findByText('Nenhum PTS ativo')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Ver propostas de PTS' }),
    ).toHaveAttribute('href', '/pts/proposals');
  });

  it('não mostra o link das propostas no 404 para o profissional', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse({ status: 'ACTIVE_PTS_NOT_FOUND' }, 404),
    );

    render(
      <PtsOverview account={professionalAccount()} patientId={PATIENT_ID} />,
    );

    expect(await screen.findByText('Nenhum PTS ativo')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Ver propostas de PTS' }),
    ).not.toBeInTheDocument();
  });

  it('redireciona para o login quando a sessão não é válida (401)', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      jsonResponse({ message: 'unauthorised' }, 401),
    );

    render(<PtsOverview account={patientAccount()} patientId={PATIENT_ID} />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  it('exibe a mensagem da API no 403 e permite tentar de novo', async () => {
    (global.fetch as jest.Mock)
      .mockImplementationOnce(() =>
        jsonResponse(
          {
            status: 'FORBIDDEN',
            message: 'Você não tem acesso ao PTS ativo deste paciente.',
          },
          403,
        ),
      )
      .mockImplementationOnce(() => jsonResponse(activePts()));

    render(
      <PtsOverview account={professionalAccount()} patientId={PATIENT_ID} />,
    );

    expect(
      await screen.findByText(
        'Você não tem acesso ao PTS ativo deste paciente.',
      ),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    );

    expect(await screen.findByText('Sobre este plano')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('não chama a API com patientId inválido', () => {
    render(
      <PtsOverview account={professionalAccount()} patientId="nao-e-uuid" />,
    );

    expect(screen.getByText('Paciente inválido')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('orienta quando não há paciente selecionado', () => {
    render(<PtsOverview account={professionalAccount()} patientId={null} />);

    expect(screen.getByText('Nenhum paciente selecionado')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('mostra o carregamento enquanto a API responde', () => {
    (global.fetch as jest.Mock).mockImplementationOnce(
      () => new Promise(() => {}),
    );

    render(<PtsOverview account={patientAccount()} patientId={PATIENT_ID} />);

    expect(screen.getByText('Carregando o PTS ativo...')).toBeInTheDocument();
  });
});
