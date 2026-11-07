import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useRouter, useSearchParams } from 'next/navigation';

import type { Account } from '@/lib/account';

import PatientsPage from './page';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

const mockedUseRouter = useRouter as jest.Mock;
const mockedUseSearchParams = useSearchParams as jest.Mock;

const API = 'http://localhost:3000';
const AUTHORIZED_URL = `${API}/patients/authorized?page=1&limit=10`;

const PROFESSIONAL: Account = {
  accountId: 'professional-account',
  name: 'Priscila Martins',
  email: 'priscila@example.com',
  role: 'user',
  patientProfileId: null,
  professionalProfileIds: ['professional-profile-uuid'],
};

const SEARCH = { name: 'Buscar paciente pelo nome' };

function mockResponse({
  status = 200,
  ok = true,
  data,
}: {
  status?: number;
  ok?: boolean;
  data?: unknown;
}) {
  return {
    status,
    ok,
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response;
}

function results(names: string[], current = 1, totalPages = 1) {
  return {
    data: names.map((name, index) => ({ id: `${current}-${index}`, name })),
    pagination: {
      page: current,
      limit: 10,
      total: names.length,
      totalPages: names.length === 0 ? 0 : totalPages,
    },
  };
}

// A lista responde conforme o `name` da URL; sem `name`, usa a chave ''.
function listByName(byName: Record<string, string[]>) {
  return jest.fn((url: string) => {
    const name = new URL(url).searchParams.get('name') ?? '';

    return Promise.resolve(mockResponse({ data: results(byName[name] ?? []) }));
  });
}

function mockApi({
  list = listByName({ '': ['Maria Silva', 'Diego Alves'] }),
  other = jest.fn(),
}: { list?: jest.Mock; other?: jest.Mock } = {}) {
  (global.fetch as jest.Mock).mockImplementation(
    (url: string, init?: RequestInit) => {
      if (url.endsWith('/me')) {
        return Promise.resolve(mockResponse({ data: PROFESSIONAL }));
      }

      if (url.startsWith(`${API}/patients/authorized`)) {
        return list(url, init);
      }

      return other(url, init);
    },
  );

  return { list, other };
}

describe('Pacientes autorizados do profissional', () => {
  const replace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockedUseRouter.mockReturnValue({ replace });
    mockedUseSearchParams.mockReturnValue(new URLSearchParams());

    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('lista os pacientes autorizados, com a ação e a nota do layout', async () => {
    const { list, other } = mockApi();

    render(<PatientsPage />);

    const items = within(
      await screen.findByRole('list', { name: 'Pacientes' }),
    );

    expect(items.getByText('Maria Silva')).toBeInTheDocument();
    expect(items.getByText('Diego Alves')).toBeInTheDocument();
    expect(screen.getByText('2 pacientes')).toBeInTheDocument();
    expect(
      screen.getByText('Somente pacientes vinculados ao seu acesso.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Criar proposta de PTS' }),
    ).toHaveAttribute('href', '/pts/novo');
    expect(
      screen.queryByRole('button', { name: 'Adicionar paciente' }),
    ).not.toBeInTheDocument();
    expect(list).toHaveBeenCalledWith(
      AUTHORIZED_URL,
      expect.objectContaining({ credentials: 'include' }),
    );
    // Não chama a lista de contas do admin.
    expect(other).not.toHaveBeenCalled();
  });

  it('lê o name da URL e busca com ele', async () => {
    mockedUseSearchParams.mockReturnValue(new URLSearchParams('name=maria'));
    const { list } = mockApi({
      list: listByName({ maria: ['Maria Silva'] }),
    });

    render(<PatientsPage />);

    expect(await screen.findByText('Maria Silva')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', SEARCH)).toHaveValue('maria');
    expect(screen.getByText('1 paciente encontrado')).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith(
      `${API}/patients/authorized?name=maria&page=1&limit=10`,
      expect.anything(),
    );
  });

  it('busca 300 ms depois da última tecla e grava o termo na URL', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const { list } = mockApi({
      list: listByName({
        '': ['Maria Silva', 'Diego Alves'],
        mar: ['Maria Silva'],
      }),
    });

    render(<PatientsPage />);

    await user.type(await screen.findByRole('searchbox', SEARCH), 'mar');

    expect(list).toHaveBeenCalledTimes(1);

    act(() => jest.advanceTimersByTime(299));

    expect(list).toHaveBeenCalledTimes(1);

    act(() => jest.advanceTimersByTime(1));

    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        `${API}/patients/authorized?name=mar&page=1&limit=10`,
        expect.anything(),
      ),
    );
    expect(replace).toHaveBeenCalledWith('/patients?name=mar', {
      scroll: false,
    });
  });

  it('não busca com menos de 2 caracteres e avisa', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const { list } = mockApi();

    render(<PatientsPage />);

    await user.type(await screen.findByRole('searchbox', SEARCH), 'm');
    act(() => jest.advanceTimersByTime(300));

    expect(list).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText('Digite ao menos 2 caracteres para buscar.'),
    ).toBeInTheDocument();
  });

  it('mostra o vazio da busca e limpa com o botão', async () => {
    mockedUseSearchParams.mockReturnValue(new URLSearchParams('name=zzz'));
    const user = userEvent.setup();
    const { list } = mockApi({
      list: listByName({ '': ['Maria Silva'], zzz: [] }),
    });

    render(<PatientsPage />);

    expect(
      await screen.findByText('Nenhum paciente encontrado'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Limpar busca' }));

    expect(await screen.findByText('Maria Silva')).toBeInTheDocument();
    expect(list).toHaveBeenLastCalledWith(AUTHORIZED_URL, expect.anything());
    expect(replace).toHaveBeenCalledWith('/patients', { scroll: false });
  });

  it('limpa a busca com Esc', async () => {
    mockedUseSearchParams.mockReturnValue(new URLSearchParams('name=maria'));
    const user = userEvent.setup();

    mockApi({ list: listByName({ '': ['Diego Alves'], maria: ['Maria'] }) });

    render(<PatientsPage />);

    const input = await screen.findByRole('searchbox', SEARCH);

    await screen.findByText('Maria');
    await user.type(input, '{Escape}');

    expect(input).toHaveValue('');
    expect(await screen.findByText('Diego Alves')).toBeInTheDocument();
  });

  it('mantém a lista anterior enquanto a busca nova carrega e descarta a superada', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const resolvers: Record<string, (value: Response) => void> = {};
    const list = jest.fn((url: string) => {
      const name = new URL(url).searchParams.get('name') ?? '';

      if (name === '') {
        return Promise.resolve(
          mockResponse({ data: results(['Maria Silva', 'Diego Alves']) }),
        );
      }

      return new Promise<Response>((resolve) => {
        resolvers[name] = resolve;
      });
    });

    mockApi({ list });
    render(<PatientsPage />);

    const input = await screen.findByRole('searchbox', SEARCH);

    await screen.findByText('Maria Silva');
    await user.type(input, 'di');
    act(() => jest.advanceTimersByTime(300));

    // Resposta ainda pendente: a lista anterior fica na tela.
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();

    await user.type(input, 'e');
    act(() => jest.advanceTimersByTime(300));

    await act(async () => {
      resolvers['die'](mockResponse({ data: results(['Diego Alves']) }));
    });
    await act(async () => {
      resolvers['di'](mockResponse({ data: results(['Dirceu Costa']) }));
    });

    expect(await screen.findByText('Diego Alves')).toBeInTheDocument();
    expect(screen.queryByText('Dirceu Costa')).not.toBeInTheDocument();
  });

  it('pagina a lista', async () => {
    const user = userEvent.setup();
    const list = jest.fn((url: string) => {
      const page = Number(new URL(url).searchParams.get('page'));

      return Promise.resolve(
        mockResponse({
          data: results([page === 1 ? 'Maria Silva' : 'Diego Alves'], page, 2),
        }),
      );
    });

    mockApi({ list });
    render(<PatientsPage />);

    expect(await screen.findByText('Maria Silva')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Próxima' }));

    expect(await screen.findByText('Diego Alves')).toBeInTheDocument();
    expect(list).toHaveBeenLastCalledWith(
      `${API}/patients/authorized?page=2&limit=10`,
      expect.anything(),
    );
  });

  it('mostra a mensagem da API e tenta de novo', async () => {
    const user = userEvent.setup();
    const list = jest
      .fn()
      .mockResolvedValueOnce(
        mockResponse({
          status: 500,
          ok: false,
          data: { status: 'ERROR', message: 'Falha ao consultar.' },
        }),
      )
      .mockResolvedValue(mockResponse({ data: results(['Maria Silva']) }));

    mockApi({ list });
    render(<PatientsPage />);

    expect(await screen.findByText('Falha ao consultar.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('Maria Silva')).toBeInTheDocument();
  });

  it('redireciona para /login no 401', async () => {
    mockApi({
      list: jest.fn().mockResolvedValue(
        mockResponse({
          status: 401,
          ok: false,
          data: { status: 'UNAUTHORIZED', message: 'Sessão inválida.' },
        }),
      ),
    });

    render(<PatientsPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });
});
