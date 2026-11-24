import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import { useRouter } from 'next/navigation';

import ProfessionalsPage from './page';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const mockedUseRouter = useRouter as jest.Mock;

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

const ACCOUNT = {
  accountId: 'account-uuid',
  name: 'Priscila Martins',
  email: 'priscila@example.com',
  role: 'user',
  patientProfileId: null,
  professionalProfileIds: ['professional-profile-uuid'],
};

// /me responde com a conta; as demais chamadas vão para o mock de profissionais.
function mockApi(professionals: jest.Mock, account: object = ACCOUNT) {
  (global.fetch as jest.Mock).mockImplementation((url: string) =>
    url.endsWith('/me')
      ? Promise.resolve(mockResponse({ data: account }))
      : professionals(url),
  );
}

describe('ProfessionalsPage', () => {
  const replace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockedUseRouter.mockReturnValue({
      replace,
    });

    global.fetch = jest.fn();
  });

  it('exibe o estado de carregamento', async () => {
    mockApi(jest.fn(() => new Promise(() => {})));

    render(<ProfessionalsPage />);

    expect(
      await screen.findByText('Carregando profissionais...'),
    ).toBeInTheDocument();
  });

  it('exibe a estrutura padrão com a conta autenticada', async () => {
    mockApi(jest.fn(() => new Promise(() => {})));

    render(<ProfessionalsPage />);

    expect(await screen.findByText('Priscila Martins')).toBeInTheDocument();

    const menu = within(
      screen.getByRole('navigation', { name: 'Menu principal' }),
    );

    expect(menu.getByRole('link', { name: 'PTS' })).toHaveAttribute(
      'href',
      '/pts/proposals',
    );
    expect(menu.getByRole('link', { name: 'Profissionais' })).toHaveAttribute(
      'href',
      '/professionals',
    );

    expect(menu.getByRole('link', { name: 'Início' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('consulta e exibe os profissionais', async () => {
    mockApi(
      jest.fn().mockResolvedValue(
        mockResponse({
          data: {
            data: [
              {
                id: 'professional-uuid',
                name: 'Maria Silva',
                email: 'maria@example.com',
                specialism: {
                  id: 'psychologist',
                  name: 'Psicologia',
                },
                registration: null,
                institution: null,
                cnes: null,
              },
            ],
            pagination: {
              page: 1,
              limit: 10,
              total: 1,
              totalPages: 1,
            },
          },
        }),
      ),
    );

    render(<ProfessionalsPage />);

    expect(await screen.findByText('Maria Silva')).toBeInTheDocument();

    expect(screen.getByText('maria@example.com')).toBeInTheDocument();

    const professionalRow = screen.getByText('Maria Silva').closest('tr');

    expect(professionalRow).not.toBeNull();

    expect(
      within(professionalRow!).getByText('Psicologia'),
    ).toBeInTheDocument();

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/professionals?page=1&limit=10',
      {
        credentials: 'include',
      },
    );
  });

  it('mostra registro, instituição e, para o admin, situação e Visualizar', async () => {
    mockApi(
      jest.fn(() =>
        Promise.resolve(
          mockResponse({
            data: {
              data: [
                {
                  id: 'professional-uuid',
                  name: 'Ana Souza',
                  email: 'ana@example.com',
                  specialism: { id: 'psychologist', name: 'Psicologia' },
                  registration: {
                    council: 'CRP',
                    number: '12345',
                    state: 'PR',
                  },
                  institution: 'IMA',
                  cnes: '2771112',
                },
              ],
              pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
            },
          }),
        ),
      ),
      { ...ACCOUNT, role: 'admin', professionalProfileIds: [] },
    );

    render(<ProfessionalsPage />);

    const row = (await screen.findByText('Ana Souza')).closest('tr')!;

    expect(within(row).getByText('CRP-PR 12345')).toBeInTheDocument();
    expect(
      within(row).getByRole('button', { name: 'Copiar Registro CRP-PR 12345' }),
    ).toBeInTheDocument();
    expect(within(row).getByText('IMA')).toBeInTheDocument();
    expect(within(row).getByText('Ativo')).toBeInTheDocument();

    fireEvent.click(
      within(row).getByRole('button', { name: 'Ações para Ana Souza' }),
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Visualizar' }));

    const dialog = screen.getByRole('dialog', { name: 'Ana Souza' });
    expect(within(dialog).getByText('2771112')).toBeInTheDocument();
    expect(within(dialog).getByText('CRP')).toBeInTheDocument();
  });

  it('não mostra situação nem ações para quem não é admin', async () => {
    mockApi(
      jest.fn(() =>
        Promise.resolve(
          mockResponse({
            data: {
              data: [
                {
                  id: 'professional-uuid',
                  name: 'Ana Souza',
                  email: 'ana@example.com',
                  specialism: { id: 'psychologist', name: 'Psicologia' },
                  registration: null,
                  institution: null,
                  cnes: null,
                },
              ],
              pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
            },
          }),
        ),
      ),
    );

    render(<ProfessionalsPage />);

    await screen.findByText('Ana Souza');
    expect(
      screen.queryByRole('columnheader', { name: 'Situação' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Ações para Ana Souza' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Registro' }),
    ).toBeInTheDocument();
  });

  it('exibe estado vazio quando não existem profissionais', async () => {
    mockApi(
      jest.fn().mockResolvedValue(
        mockResponse({
          data: {
            data: [],
            pagination: {
              page: 1,
              limit: 10,
              total: 0,
              totalPages: 0,
            },
          },
        }),
      ),
    );

    render(<ProfessionalsPage />);

    expect(
      await screen.findByText('Nenhum profissional cadastrado'),
    ).toBeInTheDocument();
  });

  it('exibe erro quando a consulta falha', async () => {
    mockApi(
      jest.fn().mockResolvedValue(
        mockResponse({
          status: 500,
          ok: false,
        }),
      ),
    );

    render(<ProfessionalsPage />);

    expect(
      await screen.findByText('Não foi possível consultar os profissionais.'),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    ).toBeInTheDocument();
  });

  it('redireciona para login quando a sessão não é válida', async () => {
    mockApi(
      jest.fn().mockResolvedValue(
        mockResponse({
          status: 401,
          ok: false,
        }),
      ),
    );

    render(<ProfessionalsPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/login');
    });
  });

  it('aplica filtros por nome e especialidade', async () => {
    mockApi(
      jest
        .fn()
        .mockResolvedValueOnce(
          mockResponse({
            data: {
              data: [],
              pagination: {
                page: 1,
                limit: 10,
                total: 0,
                totalPages: 0,
              },
            },
          }),
        )
        .mockResolvedValue(
          mockResponse({
            data: {
              data: [
                {
                  id: 'professional-uuid',
                  name: 'Maria Silva',
                  email: 'maria@example.com',
                  specialism: {
                    id: 'psychologist',
                    name: 'Psicologia',
                  },
                  registration: null,
                  institution: null,
                  cnes: null,
                },
              ],
              pagination: {
                page: 1,
                limit: 10,
                total: 1,
                totalPages: 1,
              },
            },
          }),
        ),
    );

    render(<ProfessionalsPage />);

    await screen.findByText('Nenhum profissional cadastrado');

    fireEvent.change(screen.getByPlaceholderText('Nome do profissional'), {
      target: { value: 'Maria' },
    });
    fireEvent.keyDown(screen.getByPlaceholderText('Nome do profissional'), {
      key: 'Enter',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Psicologia' }));

    expect(await screen.findByText('Maria Silva')).toBeInTheDocument();

    expect(global.fetch).toHaveBeenLastCalledWith(
      'http://localhost:3000/professionals?page=1&limit=10&name=Maria&specialism=psychologist',
      {
        credentials: 'include',
      },
    );
  });

  it('consulta a próxima página mantendo os filtros', async () => {
    mockApi(
      jest
        .fn()
        .mockResolvedValueOnce(
          mockResponse({
            data: {
              data: [
                {
                  id: '1',
                  name: 'Ana Silva',
                  email: 'ana@example.com',
                  specialism: {
                    id: 'doctor',
                    name: 'Medicina',
                  },
                  registration: null,
                  institution: null,
                  cnes: null,
                },
              ],
              pagination: {
                page: 1,
                limit: 10,
                total: 11,
                totalPages: 2,
              },
            },
          }),
        )
        .mockResolvedValueOnce(
          mockResponse({
            data: {
              data: [
                {
                  id: '11',
                  name: 'João Santos',
                  email: 'joao@example.com',
                  specialism: {
                    id: 'doctor',
                    name: 'Medicina',
                  },
                  registration: null,
                  institution: null,
                  cnes: null,
                },
              ],
              pagination: {
                page: 2,
                limit: 10,
                total: 11,
                totalPages: 2,
              },
            },
          }),
        ),
    );

    render(<ProfessionalsPage />);

    expect(await screen.findByText('Ana Silva')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Próxima página',
      }),
    );

    expect(await screen.findByText('João Santos')).toBeInTheDocument();

    expect(global.fetch).toHaveBeenLastCalledWith(
      'http://localhost:3000/professionals?page=2&limit=10',
      {
        credentials: 'include',
      },
    );
  });
});
