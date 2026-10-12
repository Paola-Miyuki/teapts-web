import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import { useRouter } from 'next/navigation';

import ProfissionaisPage from './page';

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

describe('ProfissionaisPage', () => {
  const replace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockedUseRouter.mockReturnValue({
      replace,
    });

    global.fetch = jest.fn();
  });

  it('exibe o estado de carregamento', () => {
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));

    render(<ProfissionaisPage />);

    expect(screen.getByText('Carregando profissionais...')).toBeInTheDocument();
  });

  it('consulta e exibe os profissionais', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
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
    );

    render(<ProfissionaisPage />);

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

  it('exibe estado vazio quando não existem profissionais', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
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
    );

    render(<ProfissionaisPage />);

    expect(
      await screen.findByText('Nenhum profissional encontrado'),
    ).toBeInTheDocument();
  });

  it('exibe erro quando a consulta falha', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      mockResponse({
        status: 500,
        ok: false,
      }),
    );

    render(<ProfissionaisPage />);

    expect(
      await screen.findByText('Não foi possível consultar os profissionais.'),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    ).toBeInTheDocument();
  });

  it('redireciona para login quando a sessão não é válida', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      mockResponse({
        status: 401,
        ok: false,
      }),
    );

    render(<ProfissionaisPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/login');
    });
  });

  it('aplica filtros por nome e especialidade', async () => {
    (global.fetch as jest.Mock)
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
      .mockResolvedValueOnce(
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
      );

    render(<ProfissionaisPage />);

    await screen.findByText('Nenhum profissional encontrado');

    fireEvent.change(screen.getByPlaceholderText('Buscar por nome'), {
      target: { value: 'Maria' },
    });

    fireEvent.change(
      screen.getByRole('combobox', {
        name: 'Especialidade',
      }),
      {
        target: { value: 'psychologist' },
      },
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Aplicar filtros',
      }),
    );

    expect(await screen.findByText('Maria Silva')).toBeInTheDocument();

    expect(global.fetch).toHaveBeenLastCalledWith(
      'http://localhost:3000/professionals?page=1&limit=10&name=Maria&specialism=psychologist',
      {
        credentials: 'include',
      },
    );
  });

  it('consulta a próxima página mantendo os filtros', async () => {
    (global.fetch as jest.Mock)
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
      );

    render(<ProfissionaisPage />);

    expect(await screen.findByText('Ana Silva')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Próxima',
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
