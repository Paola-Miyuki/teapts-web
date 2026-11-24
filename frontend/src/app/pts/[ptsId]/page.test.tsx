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

const PATIENT: Account = {
  accountId: 'patient-1',
  name: 'Luna Ferreira',
  email: 'luna@example.com',
  role: 'user',
  ...personalData,
  patientProfileId: 'patient-1',
  professionalProfileIds: [],
};

const TIMELINE = {
  data: [
    {
      id: 'rec-1',
      type: 'document_uploaded',
      targetType: 'document',
      targetId: 'doc-1',
      description: 'Ana Souza enviou o documento Laudo neurológico',
      happenedAt: '2026-11-12T17:45:00.000Z',
      author: { id: 'acc-1', name: 'Ana Souza' },
      assignedTo: null,
    },
  ],
  pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
};

function mockApi(
  detail: Response,
  account: Account = PROFESSIONAL,
  timeline: unknown = TIMELINE,
) {
  global.fetch = jest.fn((url: string) =>
    Promise.resolve(
      url.endsWith('/me')
        ? respond(200, account)
        : url.includes('/timeline')
          ? respond(200, timeline)
          : detail,
    ),
  ) as jest.Mock;
}

describe('PtsDetail', () => {
  const replace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace });
    window.history.replaceState(null, '', '/pts/pts-1');
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

  it('abre a aba Timeline com os eventos do PTS', async () => {
    mockApi(respond(200, PTS));

    render(<PtsDetailPage id="pts-1" />);

    fireEvent.click(await screen.findByRole('link', { name: 'Timeline' }));

    expect(
      await screen.findByText('Ana Souza enviou o documento Laudo neurológico'),
    ).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/pts/pts-1/timeline?page=1&limit=10',
      expect.anything(),
    );
    expect(screen.getByRole('link', { name: 'Timeline' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Ver documento' })).toHaveAttribute(
      'href',
      '/patients/patient-1#documentos',
    );
  });

  it('a aba segue o #hash da URL, como nos mockups', async () => {
    mockApi(respond(200, PTS));

    render(<PtsDetailPage id="pts-1" />);

    fireEvent.click(await screen.findByRole('link', { name: /Equipe/ }));
    expect(window.location.hash).toBe('#equipe');
    expect(screen.getByText('2 profissionais')).toBeInTheDocument();

    act(() => {
      window.history.replaceState(null, '', '/pts/pts-1#timeline');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    expect(
      await screen.findByText('Ana Souza enviou o documento Laudo neurológico'),
    ).toBeInTheDocument();
  });

  it('abre direto na Timeline pelo atalho #timeline', async () => {
    window.location.hash = '#timeline';
    mockApi(respond(200, PTS));

    render(<PtsDetailPage id="pts-1" />);

    expect(
      await screen.findByText('Ana Souza enviou o documento Laudo neurológico'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Mora com a mãe; concluindo o ensino médio.'),
    ).not.toBeInTheDocument();
  });

  it('mostra ao paciente o PTS sem a ficha, sem o prontuário e a timeline sem link de documento', async () => {
    const patientPts = { ...PTS };
    delete (patientPts as Partial<typeof PTS>).socialSituation;
    mockApi(respond(200, patientPts), PATIENT, {
      ...TIMELINE,
      data: [{ ...TIMELINE.data[0], targetId: null }],
    });

    render(<PtsDetailPage id="pts-1" />);

    expect(
      await screen.findByRole('heading', { name: 'PTS de Luna Ferreira' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Visão geral' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Prontuário' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('2 profissionais')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Timeline' }));

    expect(
      await screen.findByText('Ana Souza enviou o documento Laudo neurológico'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Ver documento' }),
    ).not.toBeInTheDocument();
  });

  it('não abre o PTS para a conta sem perfil', async () => {
    mockApi(respond(200, PTS), {
      ...PATIENT,
      patientProfileId: null,
    });

    render(<PtsDetailPage id="pts-1" />);

    expect(
      await screen.findByRole('heading', { name: 'Acesso restrito' }),
    ).toBeInTheDocument();
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

  describe('botão "Adicionar profissional" (RFEM001)', () => {
    const ADMIN: Account = {
      ...PROFESSIONAL,
      accountId: 'admin-uuid',
      role: 'admin',
      professionalProfileIds: [],
    };
    const MEMBER: Account = {
      ...PROFESSIONAL,
      professionalProfileIds: ['prof-2'],
    };

    async function openTeam(pts: unknown, account: Account) {
      mockApi(respond(200, pts), account);

      render(<PtsDetailPage id="pts-1" />);

      fireEvent.click(await screen.findByRole('link', { name: /Equipe/ }));
      await screen.findByRole('heading', { name: 'Equipe multidisciplinar' });
    }

    const addButton = () =>
      screen.queryByRole('button', { name: /adicionar profissional/i });

    it.each(['planning', 'running'])(
      'aparece para o responsável com o PTS em %s',
      async (status) => {
        await openTeam({ ...PTS, status }, PROFESSIONAL);

        expect(addButton()).toBeInTheDocument();
      },
    );

    it('aparece para o admin (RN022)', async () => {
      await openTeam(PTS, ADMIN);

      expect(addButton()).toBeInTheDocument();
    });

    it('não aparece para membro da equipe que não é o responsável', async () => {
      await openTeam(PTS, MEMBER);

      expect(addButton()).not.toBeInTheDocument();
    });

    it.each(['draft', 'concluded', 'cancelled', 'rejected'])(
      'não aparece, nem para o responsável nem para o admin, com o PTS em %s',
      async (status) => {
        await openTeam({ ...PTS, status }, PROFESSIONAL);
        expect(addButton()).not.toBeInTheDocument();
      },
    );

    it('não aparece para o admin com o PTS encerrado', async () => {
      await openTeam({ ...PTS, status: 'concluded' }, ADMIN);

      expect(addButton()).not.toBeInTheDocument();
    });
  });
});
