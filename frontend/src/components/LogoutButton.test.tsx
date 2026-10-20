import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import LogoutButton from './LogoutButton';

const replaceMock = jest.fn();
const refreshMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
    refresh: refreshMock,
  }),
}));

function response(body: unknown, status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('LogoutButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: jest.fn(),
      writable: true,
    });
  });

  it('exibe o botão Sair', () => {
    render(<LogoutButton />);

    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
  });

  it('aceita classe e conteúdo personalizados', () => {
    render(<LogoutButton className="custom">Sair da conta</LogoutButton>);

    expect(screen.getByRole('button', { name: 'Sair da conta' })).toHaveClass(
      'custom',
    );
  });

  it('não consulta a API antes do clique', () => {
    render(<LogoutButton />);

    expect(fetch).not.toHaveBeenCalled();
  });

  it('envia logout e redireciona para o login', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(response({ status: 'OK' }, 200));

    render(<LogoutButton />);

    const button = await screen.findByRole('button', { name: 'Sair' });

    fireEvent.click(button);

    await waitFor(() => {
      expect(fetch).toHaveBeenLastCalledWith(
        'http://localhost:3000/auth/logout',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({ allSessions: false }),
        }),
      );
    });

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/login'));

    expect(refreshMock).toHaveBeenCalled();
  });

  it('trata sessão já expirada como logout concluído', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(response({ message: 'unauthorised' }, 401));

    render(<LogoutButton />);

    const button = await screen.findByRole('button', { name: 'Sair' });

    fireEvent.click(button);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/login'));
  });

  it('exibe mensagem quando ocorre erro de rede', async () => {
    jest.mocked(fetch).mockRejectedValueOnce(new Error('network error'));

    render(<LogoutButton />);

    const button = await screen.findByRole('button', { name: 'Sair' });

    fireEvent.click(button);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível encerrar a sessão. Verifique sua conexão e tente novamente.',
    );
  });
});
