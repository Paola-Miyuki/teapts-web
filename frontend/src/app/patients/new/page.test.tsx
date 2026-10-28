import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useRouter } from 'next/navigation';

import type { Account } from '@/lib/account';

import CreatePatientPage from './page';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const mockedUseRouter = useRouter as jest.Mock;

const API = 'http://localhost:3000';
const ACCOUNTS_URL = `${API}/accounts?isPatient=false&page=1&limit=20`;

const ACCOUNT_ID = '0b6f5a4e-2c1d-4e8f-9a7b-3c2d1e0f9a8b';

const ADMIN: Account = {
  accountId: 'admin-uuid',
  name: 'Ana Admin',
  email: 'admin@example.com',
  role: 'admin',
  patientProfileId: null,
  professionalProfileIds: [],
};

const PROFESSIONAL: Account = {
  ...ADMIN,
  name: 'Priscila Martins',
  role: 'user',
  professionalProfileIds: ['professional-profile-uuid'],
};

const ACCOUNTS = {
  data: [
    { id: ACCOUNT_ID, name: 'João Martins' },
    { id: 'other-uuid', name: 'Kaio Felipe' },
  ],
  pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
};

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

type Handler = jest.Mock;

// /me responde com a conta; /accounts e /patients vão para os mocks próprios.
function mockApi({
  account = ADMIN,
  accounts = jest.fn().mockResolvedValue(mockResponse({ data: ACCOUNTS })),
  patients = jest.fn(),
}: {
  account?: Account;
  accounts?: Handler;
  patients?: Handler;
} = {}) {
  (global.fetch as jest.Mock).mockImplementation(
    (url: string, init?: RequestInit) => {
      if (url.endsWith('/me')) {
        return Promise.resolve(mockResponse({ data: account }));
      }

      if (url.startsWith(`${API}/accounts`)) {
        return accounts(url, init);
      }

      return patients(url, init);
    },
  );

  return { accounts, patients };
}

async function findAccountSelect() {
  const select = await screen.findByLabelText('Conta');

  await waitFor(() => expect(select).toBeEnabled());

  return select;
}

async function addContact(
  user: ReturnType<typeof userEvent.setup>,
  contact: {
    name?: string;
    description?: string;
    email?: string;
    phone?: string;
  },
) {
  await user.click(screen.getByRole('button', { name: 'Adicionar contato' }));

  const dialog = within(screen.getByRole('dialog'));

  if (contact.name) {
    await user.type(dialog.getByLabelText('Nome do contato'), contact.name);
  }

  if (contact.description) {
    await user.type(dialog.getByLabelText(/Descrição/), contact.description);
  }

  if (contact.email) {
    await user.type(dialog.getByLabelText(/E-mail/), contact.email);
  }

  if (contact.phone) {
    await user.type(dialog.getByLabelText(/Telefone/), contact.phone);
  }

  await user.click(dialog.getByRole('button', { name: 'Adicionar contato' }));
}

describe('CreatePatientPage', () => {
  const replace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockedUseRouter.mockReturnValue({ replace });

    global.fetch = jest.fn();
  });

  describe('acesso e contas', () => {
    it('bloqueia quem não é admin sem chamar /accounts', async () => {
      mockApi({ account: PROFESSIONAL });

      render(<CreatePatientPage />);

      expect(
        await screen.findByText('Acesso restrito ao administrador'),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText('Conta')).not.toBeInTheDocument();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('mostra o item do menu e carrega as contas sem perfil de paciente', async () => {
      mockApi();

      render(<CreatePatientPage />);

      const menu = within(
        await screen.findByRole('navigation', { name: 'Menu principal' }),
      );

      expect(
        menu.getByRole('link', { name: 'Criar perfil de paciente' }),
      ).toHaveAttribute('aria-current', 'page');

      const select = await findAccountSelect();

      expect(
        within(select)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['Selecione a conta', 'João Martins', 'Kaio Felipe']);
      expect(global.fetch).toHaveBeenCalledWith(ACCOUNTS_URL, {
        credentials: 'include',
      });
    });

    it('mostra o loading do select enquanto as contas carregam', async () => {
      mockApi({ accounts: jest.fn(() => new Promise<Response>(() => {})) });

      render(<CreatePatientPage />);

      const select = await screen.findByLabelText('Conta');

      expect(select).toBeDisabled();
      expect(
        within(select).getByRole('option', { name: 'Carregando contas...' }),
      ).toBeInTheDocument();
    });

    it('avisa quando não há contas sem perfil de paciente', async () => {
      mockApi({
        accounts: jest.fn().mockResolvedValue(
          mockResponse({
            data: {
              data: [],
              pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
            },
          }),
        ),
      });

      render(<CreatePatientPage />);

      expect(
        await screen.findByRole('option', {
          name: 'Nenhuma conta sem perfil de paciente.',
        }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Conta')).toBeDisabled();
    });

    it('mostra o erro ao carregar as contas e tenta de novo', async () => {
      const user = userEvent.setup();
      const accounts: Handler = jest
        .fn()
        .mockResolvedValueOnce(mockResponse({ status: 500, ok: false }))
        .mockResolvedValue(mockResponse({ data: ACCOUNTS }));

      mockApi({ accounts });

      render(<CreatePatientPage />);

      expect(
        await screen.findByText('Não foi possível carregar as contas.'),
      ).toBeInTheDocument();

      await user.click(
        screen.getByRole('button', { name: 'Tentar novamente' }),
      );

      expect(
        await screen.findByRole('option', { name: 'João Martins' }),
      ).toBeInTheDocument();
      expect(accounts).toHaveBeenCalledTimes(2);
    });

    it('redireciona para o login quando /accounts responde 401', async () => {
      mockApi({
        accounts: jest
          .fn()
          .mockResolvedValue(mockResponse({ status: 401, ok: false })),
      });

      render(<CreatePatientPage />);

      await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    });
  });

  describe('contatos de suporte', () => {
    it('exige o nome do contato', async () => {
      const user = userEvent.setup();
      mockApi();

      render(<CreatePatientPage />);
      await findAccountSelect();

      await addContact(user, { email: 'maria@exemplo.com' });

      const dialog = within(screen.getByRole('dialog'));

      expect(dialog.getByRole('alert')).toHaveTextContent(
        'Informe o nome do contato.',
      );
      expect(dialog.getByLabelText('Nome do contato')).toHaveAttribute(
        'aria-invalid',
        'true',
      );
    });

    it('exige um e-mail válido quando informado', async () => {
      const user = userEvent.setup();
      mockApi();

      render(<CreatePatientPage />);
      await findAccountSelect();

      await addContact(user, { name: 'Maria', email: 'maria' });

      expect(
        within(screen.getByRole('dialog')).getByRole('alert'),
      ).toHaveTextContent('Informe um e-mail válido para o contato.');
    });

    it('adiciona o contato à lista e remove pela lixeira', async () => {
      const user = userEvent.setup();
      mockApi();

      render(<CreatePatientPage />);
      await findAccountSelect();

      await addContact(user, {
        name: 'Maria Martins',
        description: 'Mãe',
        email: 'maria@exemplo.com',
        phone: '(11) 98765-4321',
      });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      const list = within(
        screen.getByRole('list', { name: 'Contatos de suporte' }),
      );

      expect(list.getByText('Maria Martins')).toBeInTheDocument();
      expect(list.getByText('Mãe')).toBeInTheDocument();
      expect(
        list.getByText('maria@exemplo.com · (11) 98765-4321'),
      ).toBeInTheDocument();

      await user.click(
        list.getByRole('button', { name: 'Remover contato Maria Martins' }),
      );

      expect(
        screen.queryByRole('list', { name: 'Contatos de suporte' }),
      ).not.toBeInTheDocument();
    });

    it('fecha o modal sem adicionar o contato', async () => {
      const user = userEvent.setup();
      mockApi();

      render(<CreatePatientPage />);
      await findAccountSelect();

      await user.click(
        screen.getByRole('button', { name: 'Adicionar contato' }),
      );
      await user.type(screen.getByLabelText('Nome do contato'), 'Maria');
      await user.click(screen.getByRole('button', { name: 'Cancelar' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('list', { name: 'Contatos de suporte' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('envio', () => {
    it('exige a conta sem chamar POST /patients', async () => {
      const user = userEvent.setup();
      const { patients } = mockApi();

      render(<CreatePatientPage />);
      await findAccountSelect();

      await user.click(
        screen.getByRole('button', { name: 'Criar perfil de paciente' }),
      );

      expect(screen.getByText('Selecione a conta.')).toBeInTheDocument();
      expect(screen.getByLabelText('Conta')).toHaveAttribute(
        'aria-invalid',
        'true',
      );
      expect(patients).not.toHaveBeenCalled();
    });

    it('cria o perfil, mostra o sucesso e tira a conta do select', async () => {
      const user = userEvent.setup();
      let resolvePost: (response: Response) => void = () => {};
      const { patients } = mockApi({
        patients: jest.fn(
          () =>
            new Promise<Response>((resolve) => {
              resolvePost = resolve;
            }),
        ),
      });

      render(<CreatePatientPage />);
      const select = await findAccountSelect();

      await user.selectOptions(select, ACCOUNT_ID);
      await addContact(user, {
        name: '  Maria Martins ',
        description: 'Mãe',
        email: 'maria@exemplo.com',
      });
      await user.click(
        screen.getByRole('button', { name: 'Criar perfil de paciente' }),
      );

      expect(
        screen.getByRole('button', { name: 'Criando perfil...' }),
      ).toBeDisabled();
      expect(patients).toHaveBeenCalledWith(`${API}/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: ACCOUNT_ID,
          supportContacts: [
            {
              name: 'Maria Martins',
              description: 'Mãe',
              email: 'maria@exemplo.com',
            },
          ],
        }),
        credentials: 'include',
      });

      resolvePost(mockResponse({ status: 201, data: {} }));

      expect(await screen.findByRole('status')).toHaveTextContent(
        'Perfil de paciente criado para João Martins.',
      );
      expect(
        screen.queryByRole('option', { name: 'João Martins' }),
      ).not.toBeInTheDocument();
      expect(screen.getByLabelText('Conta')).toHaveValue('');
      expect(
        screen.queryByRole('list', { name: 'Contatos de suporte' }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Criar perfil de paciente' }),
      ).toBeEnabled();
    });

    it('mostra a message da API quando o perfil já existe', async () => {
      const user = userEvent.setup();
      mockApi({
        patients: jest.fn().mockResolvedValue(
          mockResponse({
            status: 409,
            ok: false,
            data: {
              status: 'PATIENT_PROFILE_ALREADY_EXISTS',
              message: 'A conta já possui perfil de paciente.',
            },
          }),
        ),
      });

      render(<CreatePatientPage />);
      await user.selectOptions(await findAccountSelect(), ACCOUNT_ID);
      await user.click(
        screen.getByRole('button', { name: 'Criar perfil de paciente' }),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'A conta já possui perfil de paciente.',
      );
      expect(
        screen.getByRole('button', { name: 'Criar perfil de paciente' }),
      ).toBeEnabled();
    });

    it('mostra uma mensagem padrão quando a API não explica o erro', async () => {
      const user = userEvent.setup();
      mockApi({
        patients: jest.fn().mockRejectedValue(new TypeError('Failed to fetch')),
      });

      render(<CreatePatientPage />);
      await user.selectOptions(await findAccountSelect(), ACCOUNT_ID);
      await user.click(
        screen.getByRole('button', { name: 'Criar perfil de paciente' }),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Não foi possível criar o perfil de paciente.',
      );
    });

    it('redireciona para o login quando POST /patients responde 401', async () => {
      const user = userEvent.setup();
      mockApi({
        patients: jest
          .fn()
          .mockResolvedValue(mockResponse({ status: 401, ok: false })),
      });

      render(<CreatePatientPage />);
      await user.selectOptions(await findAccountSelect(), ACCOUNT_ID);
      await user.click(
        screen.getByRole('button', { name: 'Criar perfil de paciente' }),
      );

      await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    });
  });
});
