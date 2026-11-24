import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useRouter } from 'next/navigation';

import type { Account } from '@/lib/account';
import { personalData } from '@/test-utils/account';

import ProfileEditRoute from './edit/page';
import ProfilePage from './page';

let mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: () => mockSearchParams,
}));

const mockedUseRouter = useRouter as jest.Mock;
const API = 'http://localhost:3000';

const ACCOUNT: Account = {
  accountId: 'account-uuid',
  name: 'Maria Silva',
  email: 'maria@example.com',
  role: 'user',
  ...personalData,
  birthDate: '1988-06-12',
  sex: 'female',
  gender: 'cis_woman',
  cpf: '52998224725',
  phone: '41991002030',
  createdAt: '2026-03-12T12:00:00.000Z',
  updatedAt: '2026-10-02T12:00:00.000Z',
  patientProfileId: null,
  professionalProfileIds: ['professional-uuid'],
};

function response(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response;
}

function mockApi({
  account = ACCOUNT,
  patch = jest.fn().mockResolvedValue(response(account)),
  password = jest.fn().mockResolvedValue(response({ status: 'OK' })),
}: {
  account?: Account;
  patch?: jest.Mock;
  password?: jest.Mock;
} = {}) {
  (global.fetch as jest.Mock).mockImplementation(
    (url: string, init?: RequestInit) => {
      if (url === `${API}/me` && !init?.method) {
        return Promise.resolve(response(account));
      }

      if (url === `${API}/me/password`) {
        return password(url, init);
      }

      if (url === `${API}/me` && init?.method === 'PATCH') {
        return patch(url, init);
      }

      if (url.startsWith(`${API}/professionals?`)) {
        return Promise.resolve(
          response({
            data: [
              {
                id: 'professional-uuid',
                name: account.name,
                email: account.email,
                specialism: { id: 'psychologist', name: 'Psicólogo' },
              },
            ],
            pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
          }),
        );
      }

      return Promise.reject(new Error(`Unexpected request: ${url}`));
    },
  );

  return { patch, password };
}

async function renderProfile() {
  render(<ProfilePage />);
  await screen.findByRole('heading', { name: ACCOUNT.name });
}

async function renderEdit() {
  render(<ProfileEditRoute />);
  await screen.findByRole('heading', { name: 'Editar perfil', level: 1 });
}

describe('ProfilePage', () => {
  const replace = jest.fn();
  const push = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    mockedUseRouter.mockReturnValue({ replace, push });
    global.fetch = jest.fn();
  });

  it('mostra os dados da conta, os pessoais e a profissão', async () => {
    mockApi();

    await renderProfile();

    const facts = screen.getByRole('heading', {
      name: 'Dados da conta',
    }).parentElement!;
    expect(within(facts).getByText('maria@example.com')).toBeInTheDocument();
    expect(within(facts).getByText('(41) 99100-2030')).toBeInTheDocument();
    expect(within(facts).getByText('12/03/2026')).toBeInTheDocument();
    expect(within(facts).getByText('02/10/2026')).toBeInTheDocument();

    expect(screen.getByText('12/06/1988')).toBeInTheDocument();
    expect(
      screen.getByText(/^\d+ anos?, \d+ (mês|meses) e \d+ dias?$/),
    ).toBeInTheDocument();
    expect(screen.getByText('Feminino')).toBeInTheDocument();
    expect(screen.getByText('Mulher cisgênero')).toBeInTheDocument();
    expect(screen.getByText('529.982.247-25')).toBeInTheDocument();
    expect(await screen.findByText('Psicólogo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Editar perfil' })).toHaveAttribute(
      'href',
      '/profile/edit',
    );
    expect(
      within(screen.getByRole('complementary')).getByRole('link', {
        name: 'Meu perfil',
      }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('mostra o aviso de dados atualizados vindo da edição', async () => {
    mockSearchParams = new URLSearchParams('updated=1');
    mockApi();

    await renderProfile();

    expect(
      screen.getByText('Seus dados foram atualizados com sucesso.'),
    ).toBeInTheDocument();
  });

  it('não mostra CPF para o administrador', async () => {
    mockApi({
      account: {
        ...ACCOUNT,
        role: 'admin',
        cpf: null,
        professionalProfileIds: [],
      },
    });

    await renderProfile();

    expect(screen.queryByText('CPF')).not.toBeInTheDocument();
    expect(screen.queryByText('Dados profissionais')).not.toBeInTheDocument();
  });

  it('envia só os campos alterados e volta para Meu perfil', async () => {
    const user = userEvent.setup();
    const { patch } = mockApi();

    await renderEdit();
    await user.clear(screen.getByLabelText(/Nome completo/));
    await user.type(screen.getByLabelText(/Nome completo/), 'Maria Souza');
    await user.type(screen.getByLabelText('Nome social'), 'Mari');
    await user.selectOptions(screen.getByLabelText('Gênero'), '');
    await user.clear(screen.getByLabelText('Telefone'));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/profile?updated=1'),
    );
    expect(JSON.parse(patch.mock.calls[0][1].body)).toEqual({
      name: 'Maria Souza',
      socialName: 'Mari',
      gender: null,
      phone: null,
    });
  });

  it('valida os campos obrigatórios sem chamar PATCH', async () => {
    const user = userEvent.setup();
    const { patch } = mockApi();

    await renderEdit();
    await user.clear(screen.getByLabelText(/Nome completo/));
    await user.clear(screen.getByLabelText(/^E-mail/));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(screen.getByText('Informe seu nome completo.')).toBeInTheDocument();
    expect(screen.getByText('Informe seu e-mail.')).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();
  });

  it('mostra o erro 409 no e-mail', async () => {
    const user = userEvent.setup();
    mockApi({
      patch: jest.fn().mockResolvedValue(
        response(
          {
            status: 'EMAIL_ALREADY_EXISTS',
            message: 'Este e-mail já está cadastrado.',
          },
          409,
        ),
      ),
    });

    await renderEdit();
    await user.clear(screen.getByLabelText(/^E-mail/));
    await user.type(screen.getByLabelText(/^E-mail/), 'outra@example.com');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(
      await screen.findByText('Este e-mail já está cadastrado.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^E-mail/)).toHaveValue('outra@example.com');
  });

  it('troca a senha, fecha o formulário e mostra sucesso', async () => {
    const user = userEvent.setup();
    const { password } = mockApi();

    await renderEdit();
    await user.click(screen.getByRole('button', { name: /Redefinir senha/ }));
    await user.type(screen.getByLabelText('Senha atual'), 'senha-atual');
    await user.type(screen.getByLabelText('Nova senha'), 'senha-nova1');
    await user.type(
      screen.getByLabelText('Confirmar nova senha'),
      'senha-nova1',
    );
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    await waitFor(() => {
      expect(screen.queryByLabelText('Senha atual')).not.toBeInTheDocument();
    });
    expect(
      screen.getByText('Sua senha foi redefinida com sucesso.'),
    ).toBeInTheDocument();
    expect(password).toHaveBeenCalledWith(
      `${API}/me/password`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          currentPassword: 'senha-atual',
          newPassword: 'senha-nova1',
        }),
      }),
    );
  });

  it('valida confirmação de senha diferente sem chamar a API', async () => {
    const user = userEvent.setup();
    const { password } = mockApi();

    await renderEdit();
    await user.click(screen.getByRole('button', { name: /Redefinir senha/ }));
    await user.type(screen.getByLabelText('Senha atual'), 'senha-atual');
    await user.type(screen.getByLabelText('Nova senha'), 'senha-nova1');
    await user.type(
      screen.getByLabelText('Confirmar nova senha'),
      'outra-senha',
    );
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    expect(
      screen.getByText('A confirmação deve ser igual à nova senha.'),
    ).toBeInTheDocument();
    expect(password).not.toHaveBeenCalled();
  });

  it('impede reutilizar a senha atual sem chamar a API', async () => {
    const user = userEvent.setup();
    const { password } = mockApi();

    await renderEdit();
    await user.click(screen.getByRole('button', { name: /Redefinir senha/ }));
    await user.type(screen.getByLabelText('Senha atual'), 'senha-atual1');
    await user.type(screen.getByLabelText('Nova senha'), 'senha-atual1');
    await user.type(
      screen.getByLabelText('Confirmar nova senha'),
      'senha-atual1',
    );
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    expect(
      screen.getByText('A nova senha não pode ser igual à senha atual.'),
    ).toBeInTheDocument();
    expect(password).not.toHaveBeenCalled();
  });

  it('mostra senha atual inválida no campo correspondente', async () => {
    const user = userEvent.setup();
    mockApi({
      password: jest.fn().mockResolvedValue(
        response(
          {
            status: 'INVALID_CURRENT_PASSWORD',
            message: 'A senha atual está incorreta.',
          },
          400,
        ),
      ),
    });

    await renderEdit();
    await user.click(screen.getByRole('button', { name: /Redefinir senha/ }));
    await user.type(screen.getByLabelText('Senha atual'), 'errada');
    await user.type(screen.getByLabelText('Nova senha'), 'senha-nova1');
    await user.type(
      screen.getByLabelText('Confirmar nova senha'),
      'senha-nova1',
    );
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    expect(
      await screen.findByText('A senha atual está incorreta.'),
    ).toBeInTheDocument();
  });

  it('mantém o modal de senha aberto no Esc enquanto o envio está pendente', async () => {
    const user = userEvent.setup();
    const password = jest.fn().mockReturnValue(new Promise<Response>(() => {}));
    mockApi({ password });

    await renderEdit();
    await user.click(screen.getByRole('button', { name: /Redefinir senha/ }));

    await user.type(screen.getByLabelText('Senha atual'), 'senha-atual1');
    await user.type(screen.getByLabelText('Nova senha'), 'senha-nova1');
    await user.type(
      screen.getByLabelText('Confirmar nova senha'),
      'senha-nova1',
    );
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    const pendingEscape = new Event('cancel', { cancelable: true });
    fireEvent(screen.getByRole('dialog'), pendingEscape);

    expect(pendingEscape.defaultPrevented).toBe(true);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('fecha o modal de senha no Esc quando nada está pendente', async () => {
    const user = userEvent.setup();
    mockApi();

    await renderEdit();
    await user.click(screen.getByRole('button', { name: /Redefinir senha/ }));
    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { cancelable: true }),
    );

    await waitFor(() =>
      expect(screen.queryByLabelText('Senha atual')).not.toBeInTheDocument(),
    );
  });

  it('redireciona para login quando GET /me retorna 401', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      response({ status: 'UNAUTHORISED', message: 'Não autenticado.' }, 401),
    );

    render(<ProfilePage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });
});
