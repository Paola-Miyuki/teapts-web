import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import { useRouter } from 'next/navigation';

import type { Account } from '@/lib/account';
import { personalData } from '@/test-utils/account';

import PtsDetailPage from './PtsDetail';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const PROFESSIONAL: Account = {
  accountId: 'professional-uuid',
  name: 'Paula Profissional',
  email: 'paula@example.com',
  role: 'user',
  ...personalData,
  patientProfileId: null,
  professionalProfileIds: ['prof-1'],
};

const PTS = {
  id: 'pts-1',
  status: 'running',
  socialSituation: 'Mora com a mãe; concluindo o ensino médio.',
  createdAt: '2026-07-01T13:00:00.000Z',
  acceptedAt: '2026-07-05T13:00:00.000Z',
  rejectedAt: null,
  beganAt: '2026-08-01T13:00:00.000Z',
  concludedAt: null,
  cancelledAt: null,
  patient: { id: 'patient-1', name: 'Luna Ferreira' },
  responsible: {
    id: 'prof-1',
    name: 'Ana Souza',
    specialism: { id: 'psychologist', name: 'Psicologia' },
    registration: { council: 'CRP', number: '12345', state: 'PR' },
  },
  team: [
    {
      id: 'prof-2',
      name: 'Beatriz Lopes',
      specialism: { id: 'physiotherapist', name: 'Fisioterapia' },
      registration: null,
    },
  ],
};

function respond(status: number, data: unknown) {
  return {
    ok: status < 400,
    status,
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response;
}

function mockApi(detail: Response) {
  global.fetch = jest.fn((url: string) =>
    Promise.resolve(url.endsWith('/me') ? respond(200, PROFESSIONAL) : detail),
  ) as jest.Mock;
}

describe('PtsDetail', () => {
  const replace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace });
  });

  it('mostra o cabeçalho do PTS, a situação social e o link do prontuário', async () => {
    mockApi(respond(200, PTS));

    render(<PtsDetailPage id="pts-1" />);

    expect(
      await screen.findByRole('heading', { name: 'PTS de Luna Ferreira' }),
    ).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/pts/pts-1',
      expect.anything(),
    );
    expect(screen.getByText('Em andamento')).toBeInTheDocument();
    expect(screen.getByText('Ana Souza, Psicologia')).toBeInTheDocument();
    expect(screen.getByText('01/07/2026')).toBeInTheDocument();
    expect(screen.getByText('01/08/2026')).toBeInTheDocument();
    expect(
      screen.getByText('Mora com a mãe; concluindo o ensino médio.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Prontuário' })).toHaveAttribute(
      'href',
      '/patients/patient-1',
    );
    expect(
      within(
        screen.getByRole('navigation', { name: 'Caminho da página' }),
      ).getByText('Luna Ferreira'),
    ).toBeInTheDocument();
  });

  it('lista a equipe com registro, especialidade e papel, e filtra pela busca', async () => {
    mockApi(respond(200, PTS));

    render(<PtsDetailPage id="pts-1" />);

    fireEvent.click(await screen.findByRole('link', { name: /Equipe/ }));

    const ana = screen.getByText('Ana Souza').closest('tr')!;
    expect(within(ana).getByText('CRP-PR 12345')).toBeInTheDocument();
    expect(within(ana).getByText('Responsável')).toBeInTheDocument();

    const beatriz = screen.getByText('Beatriz Lopes').closest('tr')!;
    expect(within(beatriz).getByText('Fisioterapia')).toBeInTheDocument();
    expect(within(beatriz).getByText('Membro')).toBeInTheDocument();
    expect(screen.getByText('2 profissionais')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Nome ou registro'), {
      target: { value: 'crp-pr' },
    });
    expect(screen.queryByText('Beatriz Lopes')).not.toBeInTheDocument();
  });

  it('mostra a data de conclusão do PTS encerrado', async () => {
    mockApi(
      respond(200, {
        ...PTS,
        status: 'concluded',
        concludedAt: '2026-05-30T13:00:00.000Z',
      }),
    );

    render(<PtsDetailPage id="pts-1" />);

    expect(await screen.findByText('Concluído em')).toBeInTheDocument();
    expect(screen.getByText('30/05/2026')).toBeInTheDocument();
  });

  it('mostra o acesso negado da API', async () => {
    mockApi(
      respond(403, {
        status: 'FORBIDDEN',
        message: 'Você não tem acesso a este PTS.',
      }),
    );

    render(<PtsDetailPage id="pts-1" />);

    expect(
      await screen.findByRole('heading', { name: 'Sem acesso a este PTS' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Você não tem acesso a este PTS.'),
    ).toBeInTheDocument();
  });

  it('redireciona para o login sem sessão', async () => {
    mockApi(respond(401, { message: 'unauthorised' }));

    render(<PtsDetailPage id="pts-1" />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });
});
