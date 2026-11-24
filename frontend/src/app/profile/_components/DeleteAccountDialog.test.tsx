import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useRouter } from 'next/navigation';

import DeleteAccountDialog from './DeleteAccountDialog';

jest.mock('next/navigation', () => ({ useRouter: jest.fn() }));

const API = 'http://localhost:3000';
const replace = jest.fn();

function response(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response;
}

function renderDialog(open = true, onClose = jest.fn()) {
  render(<DeleteAccountDialog open={open} onClose={onClose} />);

  return { onClose };
}

describe('DeleteAccountDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace });
    global.fetch = jest.fn();
  });

  it('mostra "Excluir sua conta?" com o botão de confirmar em vermelho', () => {
    renderDialog();

    expect(
      screen.getByRole('heading', { name: 'Excluir sua conta?' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/dados clínicos são mantidos/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Excluir conta' })).toHaveClass(
      'btn-danger',
    );
  });

  it('não renderiza o conteúdo com o diálogo fechado', () => {
    renderDialog(false);

    expect(screen.queryByText('Excluir sua conta?')).not.toBeInTheDocument();
  });

  it('desabilita os botões e mostra o carregamento durante o envio', async () => {
    let resolve: (value: Response) => void = () => undefined;
    (global.fetch as jest.Mock).mockReturnValue(
      new Promise<Response>((r) => {
        resolve = r;
      }),
    );
    renderDialog();

    await userEvent.click(
      screen.getByRole('button', { name: 'Excluir conta' }),
    );

    const loading = screen.getByRole('button', { name: 'Excluindo...' });
    expect(loading).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      `${API}/me`,
      expect.objectContaining({ method: 'DELETE', credentials: 'include' }),
    );

    resolve(response({ id: 'a', status: 'inactive', deactivatedAt: 'x' }));
  });

  it('vai para /login depois de excluir', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      response({ id: 'a', status: 'inactive', deactivatedAt: 'x' }),
    );
    renderDialog();

    await userEvent.click(
      screen.getByRole('button', { name: 'Excluir conta' }),
    );

    await screen.findByRole('button', { name: 'Excluindo...' });
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('vai para /login no 401', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      response({ status: 'UNAUTHORIZED', message: 'x' }, 401),
    );
    renderDialog();

    await userEvent.click(
      screen.getByRole('button', { name: 'Excluir conta' }),
    );

    await screen.findByRole('button', { name: 'Excluir conta' });
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('mostra a mensagem da API no 409 sem sair da tela', async () => {
    const message =
      'A conta tem perfil responsável por um PTS ativo. Transfira a responsabilidade antes de desativar.';
    (global.fetch as jest.Mock).mockResolvedValue(
      response({ status: 'ACCOUNT_IS_PTS_RESPONSIBLE', message }, 409),
    );
    renderDialog();

    await userEvent.click(
      screen.getByRole('button', { name: 'Excluir conta' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Excluir conta' })).toBeEnabled();
  });

  it('mostra texto padrão quando a API não manda mensagem', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(response({}, 500));
    renderDialog();

    await userEvent.click(
      screen.getByRole('button', { name: 'Excluir conta' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível excluir a conta',
    );
  });

  it('Cancelar fecha o diálogo sem chamar a API', async () => {
    const { onClose } = renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onClose).toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
