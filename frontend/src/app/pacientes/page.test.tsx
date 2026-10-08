import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';

import PacientesPage from './page';

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

describe('PacientesPage', () => {
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

    render(<PacientesPage />);

    expect(screen.getByText('Carregando pacientes...')).toBeInTheDocument();
  });

  it('consulta e exibe os pacientes autorizados', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      mockResponse({
        data: {
          data: [
            {
              id: 1,
              name: 'Maria Silva',
            },
            {
              id: 2,
              name: 'João Santos',
            },
          ],
          pagination: {
            page: 1,
            limit: 10,
            total: 2,
            totalPages: 1,
          },
        },
      }),
    );

    render(<PacientesPage />);

    expect(await screen.findByText('Maria Silva')).toBeInTheDocument();

    expect(screen.getByText('João Santos')).toBeInTheDocument();

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/patients/authorized?page=1&limit=10',
      {
        credentials: 'include',
      },
    );
  });

  it('exibe o estado vazio quando não existem pacientes autorizados', async () => {
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

    render(<PacientesPage />);

    expect(
      await screen.findByText('Nenhum paciente encontrado'),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        'Você ainda não possui pacientes autorizados para consulta.',
      ),
    ).toBeInTheDocument();
  });

  it('exibe mensagem de erro quando a consulta falha', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      mockResponse({
        status: 500,
        ok: false,
      }),
    );

    render(<PacientesPage />);

    expect(
      await screen.findByText(
        'Não foi possível consultar os pacientes autorizados.',
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', {
        name: 'Tentar novamente',
      }),
    ).toBeInTheDocument();
  });

  it('redireciona para o login quando a sessão não é válida', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      mockResponse({
        status: 401,
        ok: false,
      }),
    );

    render(<PacientesPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/login');
    });
  });

  it('consulta a próxima página mantendo o limite', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        mockResponse({
          data: {
            data: [
              {
                id: 1,
                name: 'Maria Silva',
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
                id: 11,
                name: 'Ana Souza',
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

    render(<PacientesPage />);

    expect(await screen.findByText('Maria Silva')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Próxima',
      }),
    );

    expect(await screen.findByText('Ana Souza')).toBeInTheDocument();

    expect(global.fetch).toHaveBeenLastCalledWith(
      'http://localhost:3000/patients/authorized?page=2&limit=10',
      {
        credentials: 'include',
      },
    );
  });
});
