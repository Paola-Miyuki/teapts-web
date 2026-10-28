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
    patientProfileId: null,
    professionalProfileIds: [],
    ...overrides,
  };
}

function mockMe(status: number, data?: unknown) {
  (global.fetch as jest.Mock).mockImplementation(() =>
    Promise.resolve(mockResponse(status, data)),
  );
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

    await screen.findByRole('heading', { name: 'Boas-vindas, Priscila.' });

    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/me', {
      credentials: 'include',
    });
  });

  it('redireciona para o login quando a sessão não é válida', async () => {
    mockMe(401);

    render(<HomePage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });

  it('mostra o aviso de perfil a caminho para conta sem perfil', async () => {
    mockMe(200, account());

    render(<HomePage />);

    expect(
      await screen.findByRole('heading', {
        name: 'Seu perfil está a caminho.',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Aguardando perfil', { selector: 'small' }),
    ).toBeInTheDocument();
    const menu = screen.getByRole('navigation', { name: 'Menu principal' });

    expect(within(menu).getByRole('link', { name: 'Início' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('mostra o início do paciente', async () => {
    mockMe(200, account({ patientProfileId: 'patient-uuid' }));

    render(<HomePage />);

    expect(
      await screen.findByRole('heading', {
        name: 'Vamos começar seu plano de cuidado?',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Área do paciente')).toBeInTheDocument();
    expect(
      screen.getByText('Paciente', { selector: 'small' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Meu cuidado' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('mostra o início do profissional com acesso aos profissionais', async () => {
    mockMe(
      200,
      account({ name: 'Kaio Felipe', professionalProfileIds: ['pro-uuid'] }),
    );

    render(<HomePage />);

    expect(
      await screen.findByRole('heading', { name: 'Boas-vindas, Kaio.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Área profissional')).toBeInTheDocument();
    expect(
      screen.getByText('Profissional', { selector: 'small' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Consultar profissionais' }),
    ).toHaveAttribute('href', '/professionals');
    expect(screen.getByRole('link', { name: 'Profissionais' })).toHaveAttribute(
      'href',
      '/professionals',
    );
  });

  it('mostra a área administrativa para administradores', async () => {
    mockMe(200, account({ name: 'Kaio Segunda Conta', role: 'admin' }));

    render(<HomePage />);

    expect(await screen.findByText('Área administrativa')).toBeInTheDocument();
    expect(
      screen.getByText('Administrador', { selector: 'small' }),
    ).toBeInTheDocument();
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
      await screen.findByRole('heading', { name: 'Boas-vindas, Priscila.' }),
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

  it('exibe a opção de sair da conta', async () => {
    mockMe(200, account());

    render(<HomePage />);

    expect(
      await screen.findByRole('button', { name: 'Sair da conta' }),
    ).toBeInTheDocument();
  });
});
