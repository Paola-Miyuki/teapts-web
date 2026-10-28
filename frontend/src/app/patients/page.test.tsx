import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useRouter } from 'next/navigation';

import type { Account } from '@/lib/account';

import PatientsPage from './page';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const mockedUseRouter = useRouter as jest.Mock;

const API = 'http://localhost:3000';
const PATIENTS_URL = `${API}/accounts?isPatient=true&page=1&limit=10`;
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

function page(names: string[], current = 1, totalPages = 1) {
  return {
    data: names.map((name, index) => ({ id: `${current}-${index}`, name })),
    pagination: {
      page: current,
      limit: 10,
      total: totalPages * 10,
      totalPages,
    },
  };
}

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

// /me responde com a conta; a lista, as contas do select e o POST /patients
// vão para os mocks próprios.
function mockApi({
  account = ADMIN,
  list = jest
    .fn()
    .mockResolvedValue(
      mockResponse({ data: page(['Maria Sílvia', 'Diego Alves']) }),
    ),
  accounts = jest.fn().mockResolvedValue(mockResponse({ data: ACCOUNTS })),
  patients = jest.fn(),
}: {
  account?: Account;
  list?: Handler;
  accounts?: Handler;
  patients?: Handler;
} = {}) {
  (global.fetch as jest.Mock).mockImplementation(
    (url: string, init?: RequestInit) => {
      if (url.endsWith('/me')) {
        return Promise.resolve(mockResponse({ data: account }));
      }

      if (url.startsWith(`${API}/accounts?isPatient=true`)) {
        return list(url, init);
      }

      if (url.startsWith(`${API}/accounts`)) {
        return accounts(url, init);
      }

      return patients(url, init);
    },
  );

  return { list, accounts, patients };
}

async function openAddPatient(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', { name: 'Adicionar paciente' }),
  );

  const dialog = within(screen.getByRole('dialog'));
  const select = dialog.getByLabelText('Conta');

  await waitFor(() => expect(select).toBeEnabled());

  return { dialog, select };
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
  const dialog = within(screen.getByRole('dialog'));

  await user.click(dialog.getByRole('button', { name: 'Adicionar contato' }));

  const fields = within(
    dialog.getByRole('group', { name: 'Novo contato de suporte' }),
  );

  if (contact.name) {
    await user.type(fields.getByLabelText('Nome do contato'), contact.name);
  }

  if (contact.description) {
    await user.type(fields.getByLabelText(/Descrição/), contact.description);
  }

  if (contact.email) {
    await user.type(fields.getByLabelText(/E-mail/), contact.email);
  }

  if (contact.phone) {
    await user.type(fields.getByLabelText(/Telefone/), contact.phone);
  }

  await user.click(fields.getByRole('button', { name: 'Salvar contato' }));
}

describe('PatientsPage', () => {
  const replace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockedUseRouter.mockReturnValue({ replace });

    global.fetch = jest.fn();
  });

  describe('acesso e lista', () => {
    it('bloqueia quem não é admin sem chamar /accounts', async () => {
      mockApi({ account: PROFESSIONAL });

      render(<PatientsPage />);

      expect(
        await screen.findByText('Acesso restrito ao administrador'),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Adicionar paciente' }),
      ).not.toBeInTheDocument();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('lista os pacientes com o item do menu ativo', async () => {
      const { list, accounts } = mockApi();

      render(<PatientsPage />);

      const items = within(
        await screen.findByRole('list', { name: 'Pacientes' }),
      );

      expect(items.getByText('Maria Sílvia')).toBeInTheDocument();
      expect(items.getByText('Diego Alves')).toBeInTheDocument();
      expect(list).toHaveBeenCalledWith(PATIENTS_URL, {
        credentials: 'include',
      });
      // As contas do select só carregam quando o modal abre.
      expect(accounts).not.toHaveBeenCalled();

      const menu = within(
        screen.getByRole('navigation', { name: 'Menu principal' }),
      );

      expect(menu.getByRole('link', { name: 'Pacientes' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    });

    it('mostra o loading enquanto os pacientes carregam', async () => {
      mockApi({ list: jest.fn(() => new Promise<Response>(() => {})) });

      render(<PatientsPage />);

      expect(
        await screen.findByText('Carregando pacientes...'),
      ).toBeInTheDocument();
    });

    it('avisa quando não há pacientes e abre o modal pelo vazio', async () => {
      const user = userEvent.setup();
      mockApi({
        list: jest
          .fn()
          .mockResolvedValue(mockResponse({ data: page([], 1, 0) })),
      });

      render(<PatientsPage />);

      expect(
        await screen.findByText('Nenhum paciente cadastrado'),
      ).toBeInTheDocument();

      const [, emptyButton] = screen.getAllByRole('button', {
        name: 'Adicionar paciente',
      });

      await user.click(emptyButton);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('mostra o erro e tenta de novo', async () => {
      const user = userEvent.setup();
      const { list } = mockApi({
        list: jest
          .fn()
          .mockResolvedValueOnce(mockResponse({ status: 500, ok: false }))
          .mockResolvedValue(mockResponse({ data: page(['Maria Sílvia']) })),
      });

      render(<PatientsPage />);

      expect(
        await screen.findByText('Não foi possível carregar os pacientes'),
      ).toBeInTheDocument();

      await user.click(
        screen.getByRole('button', { name: 'Tentar novamente' }),
      );

      expect(await screen.findByText('Maria Sílvia')).toBeInTheDocument();
      expect(list).toHaveBeenCalledTimes(2);
    });

    it('redireciona para o login quando a lista responde 401', async () => {
      mockApi({
        list: jest
          .fn()
          .mockResolvedValue(mockResponse({ status: 401, ok: false })),
      });

      render(<PatientsPage />);

      await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    });

    it('pagina a lista', async () => {
      const user = userEvent.setup();
      const { list } = mockApi({
        list: jest
          .fn()
          .mockResolvedValueOnce(mockResponse({ data: page(['João'], 1, 2) }))
          .mockResolvedValue(mockResponse({ data: page(['Kaio'], 2, 2) })),
      });

      render(<PatientsPage />);

      expect(await screen.findByText('Página 1 de 2')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Próxima' }));

      expect(await screen.findByText('Kaio')).toBeInTheDocument();
      expect(screen.getByText('Página 2 de 2')).toBeInTheDocument();
      expect(list).toHaveBeenLastCalledWith(
        `${API}/accounts?isPatient=true&page=2&limit=10`,
        { credentials: 'include' },
      );
    });
  });

  describe('modal "Adicionar paciente"', () => {
    it('carrega as contas que ainda não são pacientes', async () => {
      const user = userEvent.setup();
      const { accounts } = mockApi();

      render(<PatientsPage />);

      const { select } = await openAddPatient(user);

      expect(
        within(select)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['Selecione a conta', 'João Martins', 'Kaio Felipe']);
      expect(accounts).toHaveBeenCalledWith(ACCOUNTS_URL, {
        credentials: 'include',
      });
    });

    it('mostra o loading do select enquanto as contas carregam', async () => {
      const user = userEvent.setup();
      mockApi({ accounts: jest.fn(() => new Promise<Response>(() => {})) });

      render(<PatientsPage />);

      await user.click(
        await screen.findByRole('button', { name: 'Adicionar paciente' }),
      );

      const select = within(screen.getByRole('dialog')).getByLabelText('Conta');

      expect(select).toBeDisabled();
      expect(
        within(select).getByRole('option', { name: 'Carregando contas...' }),
      ).toBeInTheDocument();
    });

    it('avisa quando não há contas disponíveis', async () => {
      const user = userEvent.setup();
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

      render(<PatientsPage />);

      await user.click(
        await screen.findByRole('button', { name: 'Adicionar paciente' }),
      );

      expect(
        await screen.findByRole('option', {
          name: 'Nenhuma conta disponível.',
        }),
      ).toBeInTheDocument();
    });

    it('mostra o erro ao carregar as contas e tenta de novo', async () => {
      const user = userEvent.setup();
      const { accounts } = mockApi({
        accounts: jest
          .fn()
          .mockResolvedValueOnce(mockResponse({ status: 500, ok: false }))
          .mockResolvedValue(mockResponse({ data: ACCOUNTS })),
      });

      render(<PatientsPage />);

      await user.click(
        await screen.findByRole('button', { name: 'Adicionar paciente' }),
      );

      const dialog = within(screen.getByRole('dialog'));

      expect(
        await dialog.findByText('Não foi possível carregar as contas.'),
      ).toBeInTheDocument();

      await user.click(
        dialog.getByRole('button', { name: 'Tentar novamente' }),
      );

      expect(
        await dialog.findByRole('option', { name: 'João Martins' }),
      ).toBeInTheDocument();
      expect(accounts).toHaveBeenCalledTimes(2);
    });

    it('explica a conta e os contatos em tooltips de ajuda', async () => {
      const user = userEvent.setup();
      mockApi();

      render(<PatientsPage />);

      const { dialog, select } = await openAddPatient(user);

      expect(select).toHaveAccessibleDescription(
        'Conta já cadastrada que passa a ser paciente. Contas que já são pacientes não aparecem.',
      );
      expect(
        dialog.getByRole('group', { name: /Contatos de suporte/ }),
      ).toHaveAccessibleDescription(
        'Pessoas que ajudam no cuidado. Um contato de suporte não é responsável tutelar e não acessa informações clínicas.',
      );

      const help = dialog.getByRole('button', { name: 'Ajuda: Conta' });

      await user.click(help);
      expect(help).toHaveAttribute('aria-expanded', 'true');

      // O Esc fecha só o tooltip, não o modal.
      await user.keyboard('{Escape}');
      expect(help).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('fecha pelo Cancelar e volta vazio ao reabrir', async () => {
      const user = userEvent.setup();
      mockApi();

      render(<PatientsPage />);

      const { dialog, select } = await openAddPatient(user);

      await user.selectOptions(select, ACCOUNT_ID);
      await user.click(dialog.getByRole('button', { name: 'Cancelar' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      const reopened = await openAddPatient(user);

      expect(reopened.select).toHaveValue('');
    });
  });

  describe('contatos de suporte (opcionais)', () => {
    it('exige o nome do contato', async () => {
      const user = userEvent.setup();
      mockApi();

      render(<PatientsPage />);
      await openAddPatient(user);

      await addContact(user, { email: 'maria@exemplo.com' });

      const fields = within(
        screen.getByRole('group', { name: 'Novo contato de suporte' }),
      );

      expect(fields.getByRole('alert')).toHaveTextContent(
        'Informe o nome do contato.',
      );
      expect(fields.getByLabelText('Nome do contato')).toHaveAttribute(
        'aria-invalid',
        'true',
      );
    });

    it('exige um e-mail válido quando informado', async () => {
      const user = userEvent.setup();
      mockApi();

      render(<PatientsPage />);
      await openAddPatient(user);

      await addContact(user, { name: 'Maria', email: 'maria' });

      expect(
        within(
          screen.getByRole('group', { name: 'Novo contato de suporte' }),
        ).getByRole('alert'),
      ).toHaveTextContent('Informe um e-mail válido para o contato.');
    });

    it('exige um telefone válido quando informado', async () => {
      const user = userEvent.setup();
      mockApi();

      render(<PatientsPage />);
      await openAddPatient(user);

      await addContact(user, { name: 'Maria', phone: '98765' });

      const fields = within(
        screen.getByRole('group', { name: 'Novo contato de suporte' }),
      );

      expect(fields.getByRole('alert')).toHaveTextContent(
        'Informe um telefone válido para o contato.',
      );
      expect(fields.getByLabelText(/Telefone/)).toHaveAttribute(
        'aria-invalid',
        'true',
      );
    });

    it('mostra o contato com rótulos e remove pela lixeira', async () => {
      const user = userEvent.setup();
      mockApi();

      render(<PatientsPage />);
      await openAddPatient(user);

      await addContact(user, {
        name: 'Maria Martins',
        description: 'Mãe',
        email: 'maria@exemplo.com',
        phone: '(11) 98765-4321',
      });

      expect(
        screen.queryByRole('group', { name: 'Novo contato de suporte' }),
      ).not.toBeInTheDocument();

      const list = within(
        screen.getByRole('list', { name: 'Contatos de suporte' }),
      );

      // Cada dado aparece com o rótulo do que ele representa.
      const values = Object.fromEntries(
        list
          .getAllByRole('term')
          .map((term) => [
            term.textContent,
            term.nextElementSibling?.textContent,
          ]),
      );

      expect(values).toEqual({
        Nome: 'Maria Martins',
        Descrição: 'Mãe',
        'E-mail': 'maria@exemplo.com',
        Telefone: '(11) 98765-4321',
      });

      await user.click(
        list.getByRole('button', { name: 'Remover contato Maria Martins' }),
      );

      expect(
        screen.queryByRole('list', { name: 'Contatos de suporte' }),
      ).not.toBeInTheDocument();
    });

    it('marca como não informados os dados opcionais vazios', async () => {
      const user = userEvent.setup();
      mockApi();

      render(<PatientsPage />);
      await openAddPatient(user);

      await addContact(user, { name: 'Maria Martins' });

      const list = within(
        screen.getByRole('list', { name: 'Contatos de suporte' }),
      );

      expect(list.getAllByText('Não informado')).toHaveLength(3);
    });

    it('descarta o contato sem fechar o modal', async () => {
      const user = userEvent.setup();
      mockApi();

      render(<PatientsPage />);
      const { dialog } = await openAddPatient(user);

      await user.click(
        dialog.getByRole('button', { name: 'Adicionar contato' }),
      );
      await user.type(dialog.getByLabelText('Nome do contato'), 'Maria');
      await user.click(
        dialog.getByRole('button', { name: 'Descartar contato' }),
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(
        screen.queryByRole('list', { name: 'Contatos de suporte' }),
      ).not.toBeInTheDocument();
    });

    it('salva o contato com Enter sem enviar o paciente', async () => {
      const user = userEvent.setup();
      const { patients } = mockApi();

      render(<PatientsPage />);
      const { dialog } = await openAddPatient(user);

      await user.click(
        dialog.getByRole('button', { name: 'Adicionar contato' }),
      );
      await user.type(dialog.getByLabelText('Nome do contato'), 'Maria{Enter}');

      expect(
        within(
          screen.getByRole('list', { name: 'Contatos de suporte' }),
        ).getByText('Maria'),
      ).toBeInTheDocument();
      expect(patients).not.toHaveBeenCalled();
    });
  });

  describe('envio', () => {
    it('exige a conta sem chamar POST /patients', async () => {
      const user = userEvent.setup();
      const { patients } = mockApi();

      render(<PatientsPage />);
      const { dialog, select } = await openAddPatient(user);

      await user.click(
        dialog.getByRole('button', { name: 'Adicionar paciente' }),
      );

      expect(dialog.getByText('Selecione a conta.')).toBeInTheDocument();
      expect(select).toHaveAttribute('aria-invalid', 'true');
      expect(patients).not.toHaveBeenCalled();
    });

    it('adiciona o paciente, fecha o modal e recarrega a lista', async () => {
      const user = userEvent.setup();
      let resolvePost: (response: Response) => void = () => {};
      const { list, patients } = mockApi({
        patients: jest.fn(
          () =>
            new Promise<Response>((resolve) => {
              resolvePost = resolve;
            }),
        ),
      });

      render(<PatientsPage />);
      const { dialog, select } = await openAddPatient(user);

      await user.selectOptions(select, ACCOUNT_ID);
      await addContact(user, {
        name: '  Maria Martins ',
        description: 'Mãe',
        email: 'maria@exemplo.com',
      });
      await user.click(
        dialog.getByRole('button', { name: 'Adicionar paciente' }),
      );

      expect(
        dialog.getByRole('button', { name: 'Adicionando...' }),
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

      expect(
        await screen.findByText('Paciente João Martins adicionado.'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    });

    it('adiciona o paciente sem contatos de suporte', async () => {
      const user = userEvent.setup();
      const { patients } = mockApi({
        patients: jest
          .fn()
          .mockResolvedValue(mockResponse({ status: 201, data: {} })),
      });

      render(<PatientsPage />);
      const { dialog, select } = await openAddPatient(user);

      await user.selectOptions(select, ACCOUNT_ID);
      await user.click(
        dialog.getByRole('button', { name: 'Adicionar paciente' }),
      );

      expect(
        await screen.findByText('Paciente João Martins adicionado.'),
      ).toBeInTheDocument();
      expect(patients).toHaveBeenCalledWith(
        `${API}/patients`,
        expect.objectContaining({
          body: JSON.stringify({ accountId: ACCOUNT_ID, supportContacts: [] }),
        }),
      );
    });

    it('mostra a message da API quando a conta já é paciente', async () => {
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

      render(<PatientsPage />);
      const { dialog, select } = await openAddPatient(user);

      await user.selectOptions(select, ACCOUNT_ID);
      await user.click(
        dialog.getByRole('button', { name: 'Adicionar paciente' }),
      );

      expect(await dialog.findByRole('alert')).toHaveTextContent(
        'A conta já possui perfil de paciente.',
      );
      expect(
        dialog.getByRole('button', { name: 'Adicionar paciente' }),
      ).toBeEnabled();
    });

    it('mostra uma mensagem padrão quando a API não explica o erro', async () => {
      const user = userEvent.setup();
      mockApi({
        patients: jest.fn().mockRejectedValue(new TypeError('Failed to fetch')),
      });

      render(<PatientsPage />);
      const { dialog, select } = await openAddPatient(user);

      await user.selectOptions(select, ACCOUNT_ID);
      await user.click(
        dialog.getByRole('button', { name: 'Adicionar paciente' }),
      );

      expect(await dialog.findByRole('alert')).toHaveTextContent(
        'Não foi possível adicionar o paciente.',
      );
    });

    it('redireciona para o login quando POST /patients responde 401', async () => {
      const user = userEvent.setup();
      mockApi({
        patients: jest
          .fn()
          .mockResolvedValue(mockResponse({ status: 401, ok: false })),
      });

      render(<PatientsPage />);
      const { dialog, select } = await openAddPatient(user);

      await user.selectOptions(select, ACCOUNT_ID);
      await user.click(
        dialog.getByRole('button', { name: 'Adicionar paciente' }),
      );

      await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    });
  });
});
