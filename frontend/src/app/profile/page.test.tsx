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

import ProfilePage from './page';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const mockedUseRouter = useRouter as jest.Mock;
const API = 'http://localhost:3000';

const ACCOUNT: Account = {
  accountId: 'account-uuid',
  name: 'Maria Silva',
  email: 'maria@example.com',
  role: 'user',
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
  contacts = jest.fn(),
}: {
  account?: Account;
  patch?: jest.Mock;
  password?: jest.Mock;
  contacts?: jest.Mock;
} = {}) {
  (global.fetch as jest.Mock).mockImplementation(
    (url: string, init?: RequestInit) => {
      if (url === `${API}/me` && !init?.method) {
        return Promise.resolve(response(account));
      }

      if (url.endsWith('/support-contacts')) {
        return contacts(url, init);
      }

      if (url === `${API}/me/password`) {
        return password(url, init);
      }

      if (url === `${API}/me` && init?.method === 'PATCH') {
        return patch(url, init);
      }

      return Promise.reject(new Error(`Unexpected request: ${url}`));
    },
  );

  return { patch, password, contacts };
}

async function renderProfile() {
  render(<ProfilePage />);
  await screen.findByRole('heading', { name: ACCOUNT.name });
}

describe('ProfilePage', () => {
  const replace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseRouter.mockReturnValue({ replace });
    global.fetch = jest.fn();
  });

  it('renderiza os dados da conta e Meu perfil no AppShell', async () => {
    mockApi();

    await renderProfile();

    expect(
      screen.getByRole('heading', { name: 'Meu perfil' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Seus dados de identificação e os perfis associados à sua conta.',
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Profissional')).toHaveLength(2);
    expect(screen.getByText('E-mail')).toBeInTheDocument();
    expect(
      screen.getByText(
        'As permissões de acesso dependem dos perfis e dos vínculos autorizados para a sua conta.',
      ),
    ).toBeInTheDocument();
    // O perfil fica no cabeçalho (não na barra lateral) e marca a página.
    expect(screen.getByRole('link', { name: /^Meu perfil: / })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      within(screen.getByRole('complementary')).queryByRole('link', {
        name: /Meu perfil/,
      }),
    ).not.toBeInTheDocument();
  });

  it('edita somente o nome e atualiza o cartão e o cabeçalho', async () => {
    const user = userEvent.setup();
    const updated = { ...ACCOUNT, name: 'Maria Souza' };
    const { patch } = mockApi({
      patch: jest.fn().mockResolvedValue(response(updated)),
    });

    await renderProfile();
    await user.click(screen.getByRole('button', { name: 'Editar' }));
    await user.clear(screen.getByLabelText('Nome completo'));
    await user.type(screen.getByLabelText('Nome completo'), 'Maria Souza');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Maria Souza' }),
      ).toBeInTheDocument(),
    );
    expect(patch).toHaveBeenCalledWith(
      `${API}/me`,
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ name: 'Maria Souza' }),
      }),
    );
    expect(
      screen.getByText('Seus dados foram atualizados com sucesso.'),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Salvando...' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('valida nome e e-mail sem chamar PATCH', async () => {
    const user = userEvent.setup();
    const { patch } = mockApi();

    await renderProfile();
    await user.click(screen.getByRole('button', { name: 'Editar' }));
    await user.clear(screen.getByLabelText('Nome completo'));
    await user.clear(screen.getByLabelText('E-mail'));
    await user.type(screen.getByLabelText('E-mail'), 'invalido');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(screen.getByText('Informe seu nome completo.')).toBeInTheDocument();
    expect(
      screen.getByText('Informe um e-mail válido, como nome@exemplo.com.'),
    ).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();
  });

  it('mostra o erro 409 no e-mail e preserva o texto digitado', async () => {
    const user = userEvent.setup();
    mockApi({
      patch: jest.fn().mockResolvedValue(
        response(
          {
            status: 'EMAIL_ALREADY_EXISTS',
            message: 'Este e-mail já está em uso.',
          },
          409,
        ),
      ),
    });

    await renderProfile();
    await user.click(screen.getByRole('button', { name: 'Editar' }));
    const email = screen.getByLabelText('E-mail');
    await user.clear(email);
    await user.type(email, 'usado@example.com');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(
      await screen.findByText('Este e-mail já está em uso.'),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('usado@example.com')).toBeInTheDocument();
  });

  it('troca a senha, fecha o formulário e mostra sucesso', async () => {
    const user = userEvent.setup();
    const { password } = mockApi();

    await renderProfile();
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

    await renderProfile();
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

    await renderProfile();
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

    await renderProfile();
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

    await renderProfile();
    await user.click(screen.getByRole('button', { name: /Redefinir senha/ }));

    const idleEscape = new Event('cancel', { cancelable: true });
    fireEvent(screen.getByRole('dialog'), idleEscape);
    expect(idleEscape.defaultPrevented).toBe(false);

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

  it('redireciona para login quando GET /me retorna 401', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      response({ status: 'UNAUTHORISED', message: 'Não autenticado.' }, 401),
    );

    render(<ProfilePage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });

  it('desabilita o envio enquanto a atualização está pendente', async () => {
    const user = userEvent.setup();
    let resolvePatch!: (value: Response) => void;
    const patch = jest.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolvePatch = resolve;
      }),
    );
    mockApi({ patch });

    await renderProfile();
    await user.click(screen.getByRole('button', { name: 'Editar' }));
    await user.clear(screen.getByLabelText('Nome completo'));
    await user.type(screen.getByLabelText('Nome completo'), 'Maria Souza');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(screen.getByRole('button', { name: 'Salvando...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Salvando...' })).toBeDisabled();

    resolvePatch(response({ ...ACCOUNT, name: 'Maria Souza' }));
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Maria Souza' }),
      ).toBeInTheDocument(),
    );
  });

  describe('contatos de suporte do paciente (RFPAC003)', () => {
    const PATIENT: Account = {
      ...ACCOUNT,
      accountId: 'patient-uuid',
      patientProfileId: 'patient-uuid',
      professionalProfileIds: [],
    };
    const CONTACTS_URL = `${API}/patients/patient-uuid/support-contacts`;
    const JOANA = { name: 'Joana Silva', phone: '(11) 98765-4321' };

    function profile(supportContacts: unknown[]) {
      return response({ accountId: 'patient-uuid', supportContacts });
    }

    it('não mostra a seção para quem não é paciente', async () => {
      const { contacts } = mockApi();

      await renderProfile();

      expect(
        screen.queryByRole('heading', { name: 'Contatos de suporte' }),
      ).not.toBeInTheDocument();
      expect(contacts).not.toHaveBeenCalled();
    });

    it('mostra os contatos do paciente e edita pelo modal', async () => {
      const user = userEvent.setup();
      const contacts = jest.fn((_url: string, init?: RequestInit) =>
        Promise.resolve(
          init?.method === 'PUT'
            ? profile(
                (
                  JSON.parse(String(init.body)) as {
                    supportContacts: unknown[];
                  }
                ).supportContacts,
              )
            : profile([JOANA]),
        ),
      );
      mockApi({ account: PATIENT, contacts });

      await renderProfile();

      const section = within(
        screen.getByRole('region', { name: 'Contatos de suporte' }),
      );

      expect(
        await section.findByRole('list', { name: 'Contatos de suporte' }),
      ).toHaveTextContent('Joana Silva');
      // Na página, a lista é só para leitura.
      expect(
        section.queryByRole('button', { name: /Remover contato/ }),
      ).not.toBeInTheDocument();

      await user.click(
        section.getByRole('button', { name: 'Editar contatos' }),
      );

      const dialog = within(
        screen.getByRole('dialog', { name: 'Contatos de suporte' }),
      );

      await user.click(
        await dialog.findByRole('button', {
          name: 'Remover contato Joana Silva',
        }),
      );
      await user.click(
        dialog.getByRole('button', { name: 'Adicionar contato' }),
      );
      await user.type(dialog.getByLabelText('Nome do contato'), 'Ana Lima');
      await user.click(dialog.getByRole('button', { name: 'Salvar contatos' }));

      expect(await screen.findByRole('status')).toHaveTextContent(
        'Seus contatos de suporte foram atualizados.',
      );
      expect(
        screen.queryByRole('dialog', { name: 'Contatos de suporte' }),
      ).not.toBeInTheDocument();
      expect(
        section.getByRole('list', { name: 'Contatos de suporte' }),
      ).toHaveTextContent('Ana Lima');
      expect(section.queryByText('Joana Silva')).not.toBeInTheDocument();

      const put = contacts.mock.calls.find(
        ([, init]) => init?.method === 'PUT',
      );

      expect(put?.[0]).toBe(CONTACTS_URL);
      expect(JSON.parse(String(put?.[1]?.body))).toEqual({
        supportContacts: [{ name: 'Ana Lima' }],
      });
    });

    it('avisa quando o paciente não tem contatos', async () => {
      mockApi({
        account: PATIENT,
        contacts: jest.fn().mockResolvedValue(profile([])),
      });

      await renderProfile();

      expect(
        await screen.findByText('Nenhum contato de suporte cadastrado.'),
      ).toBeInTheDocument();
    });

    it('mostra a message da API quando os contatos não carregam', async () => {
      mockApi({
        account: PATIENT,
        contacts: jest
          .fn()
          .mockResolvedValue(
            response({ status: 'FORBIDDEN', message: 'Acesso restrito.' }, 403),
          ),
      });

      await renderProfile();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Acesso restrito.',
      );
    });

    it('redireciona para o login quando os contatos respondem 401', async () => {
      mockApi({
        account: PATIENT,
        contacts: jest.fn().mockResolvedValue(response(null, 401)),
      });

      await renderProfile();

      await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    });
  });
});
