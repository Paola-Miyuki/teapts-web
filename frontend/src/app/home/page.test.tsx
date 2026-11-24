import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import { useRouter } from 'next/navigation';

import HomePage from './page';
import type { Account } from '@/lib/account';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const mockedUseRouter = useRouter as jest.Mock;

function mockResponse(status: number, data?: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response;
}

function account(overrides: Partial<Account> = {}): Account {
  return {
    accountId: 'account-uuid',
    name: 'Priscila Martins',
    email: 'priscila@example.com',
    role: 'user',
    socialName: null,
    birthDate: '1994-12-01',
    sex: 'female',
    gender: null,
    cpf: '52998224725',
    phone: null,
    createdAt: '2026-11-14T12:00:00.000Z',
    updatedAt: null,
    patientProfileId: null,
    professionalProfileIds: [],
    ...overrides,
  };
}

function page(total: number, data: unknown[] = []) {
  return {
    data,
    pagination: { page: 1, limit: 1, total, totalPages: total ? 1 : 0 },
  };
}

const proposal = {
  id: 'proposal-1',
  status: 'draft',
  createdAt: '2026-10-28T12:00:00.000Z',
  patient: { id: 'patient-uuid', name: 'Luna Ferreira' },
  responsible: {
    id: 'pro-uuid',
    name: 'Ana Souza',
    specialism: { id: 'psychologist', name: 'Psicólogo' },
  },
  team: [],
};

// /me responde `data`; as listas usadas no início respondem `lists`.
function mockMe(
  status: number,
  data?: unknown,
  lists: Record<string, unknown> = {},
) {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    const path = new URL(url).pathname;

    return Promise.resolve(
      path === '/me'
        ? mockResponse(status, data)
        : mockResponse(200, lists[path] ?? page(0)),
    );
  });
}

describe('HomePage', () => {
  const replace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockedUseRouter.mockReturnValue({ replace, refresh: jest.fn() });

    global.fetch = jest.fn();
  });

  it('exibe o carregamento enquanto consulta a conta', () => {
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));

    render(<HomePage />);

    expect(screen.getByText('Carregando sua conta...')).toBeInTheDocument();
  });

  it('consulta /me enviando os cookies da sessão', async () => {
    mockMe(200, account());

    render(<HomePage />);

    await screen.findByRole('heading', { name: 'Boas-vindas, Priscila' });

    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/me', {
      credentials: 'include',
    });
  });

  it('redireciona para o login quando a sessão não é válida', async () => {
    mockMe(401);

    render(<HomePage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });

  it('mostra a conta sem perfil aguardando aprovação', async () => {
    mockMe(200, account());

    render(<HomePage />);

    expect(
      await screen.findByRole('heading', { name: 'Aguardando aprovação' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Aguardando aprovação', { selector: 'small' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Ir para Meu perfil' }),
    ).toHaveAttribute('href', '/profile');
    const menu = screen.getByRole('navigation', { name: 'Menu principal' });

    expect(within(menu).getByRole('link', { name: 'Início' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('mostra ao paciente a proposta que aguarda a decisão dele', async () => {
    mockMe(200, account({ patientProfileId: 'patient-uuid' }), {
      '/pts/proposals': page(1, [proposal]),
    });

    render(<HomePage />);

    expect(
      await screen.findByRole('heading', {
        name: 'Proposta de PTS aguardando você',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('28/10/2026')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver proposta' })).toHaveAttribute(
      'href',
      '/pts/proposals',
    );
    expect(
      screen.getByText('Paciente', { selector: 'small' }),
    ).toBeInTheDocument();
    const menu = screen.getByRole('navigation', { name: 'Menu principal' });
    expect(within(menu).getByRole('link', { name: 'Início' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('avisa o paciente sem proposta aguardando', async () => {
    mockMe(200, account({ patientProfileId: 'patient-uuid' }));

    render(<HomePage />);

    expect(
      await screen.findByRole('heading', {
        name: 'Nenhuma proposta aguardando você',
      }),
    ).toBeInTheDocument();
  });

  it('mostra o início do profissional com acesso aos PTS', async () => {
    mockMe(
      200,
      account({ name: 'Kaio Felipe', professionalProfileIds: ['pro-uuid'] }),
      {
        '/patients/authorized': page(4),
        '/pts/proposals': page(1, [proposal]),
      },
    );

    render(<HomePage />);

    expect(
      await screen.findByRole('heading', { name: 'Boas-vindas, Kaio' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Profissional', { selector: 'small' }),
    ).toBeInTheDocument();

    const patientsTile = await screen.findByRole('link', {
      name: /Pacientes Vinculados a você 4/,
    });
    expect(patientsTile).toHaveAttribute('href', '/patients');
    expect(
      screen.getByRole('link', { name: /Propostas Aguardando o paciente 1/ }),
    ).toHaveAttribute('href', '/pts/proposals');
    expect(
      screen.getByText('Luna Ferreira · criada em 28/10/2026.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Criar proposta de PTS' }),
    ).toHaveAttribute('href', '/pts/novo');
    expect(screen.getByRole('link', { name: 'PTS' })).toHaveAttribute(
      'href',
      '/pts/proposals',
    );
    expect(screen.getByRole('link', { name: 'Profissionais' })).toHaveAttribute(
      'href',
      '/professionals',
    );
  });

  it('mostra as contagens e os atalhos do administrador', async () => {
    mockMe(200, account({ name: 'Kaio Segunda Conta', role: 'admin' }), {
      '/accounts': page(3),
      '/patients/authorized': page(23),
      '/professionals': page(18),
    });

    render(<HomePage />);

    expect(
      await screen.findByText('Administrador', { selector: 'small' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('link', { name: /Pacientes Cadastrados 23/ }),
    ).toHaveAttribute('href', '/patients');
    expect(
      await screen.findByRole('link', { name: /Profissionais Cadastrados 18/ }),
    ).toHaveAttribute('href', '/professionals');
    expect(await screen.findByText('3')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Adicionar paciente/ }),
    ).toHaveAttribute('href', '/patients');
  });

  it('permite tentar novamente quando a consulta falha', async () => {
    mockMe(500);

    render(<HomePage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar os dados da sua conta.',
    );

    mockMe(200, account());

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(
      await screen.findByRole('heading', { name: 'Boas-vindas, Priscila' }),
    ).toBeInTheDocument();
  });

  it('recolhe e expande a barra lateral', async () => {
    mockMe(200, account());

    render(<HomePage />);

    const toggle = await screen.findByRole('button', {
      name: 'Recolher barra lateral',
    });

    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(toggle);

    expect(
      screen.getByRole('button', { name: 'Expandir barra lateral' }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('leva ao perfil pela foto do usuário no cabeçalho', async () => {
    mockMe(200, account());

    render(<HomePage />);

    const profile = await screen.findByRole('link', {
      name: /^Meu perfil: Priscila/,
    });

    expect(profile).toHaveAttribute('href', '/profile');
    expect(profile.closest('header')).not.toBeNull();
    expect(screen.queryByText('Área de trabalho')).not.toBeInTheDocument();
  });

  it('exibe a opção de sair da conta', async () => {
    mockMe(200, account());

    render(<HomePage />);

    expect(
      await screen.findByRole('button', { name: 'Sair da conta' }),
    ).toBeInTheDocument();
  });
});
