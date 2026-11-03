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
const PATIENTS_URL = `${API}/accounts?isPatient=true&page=1&limit=10`;
const ACCOUNTS_URL = `${API}/accounts?isPatient=false&isProfessional=false&page=1&limit=20`;

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
    { id: ACCOUNT_ID, name: 'João Martins', email: 'joao@exemplo.com' },
    { id: 'other-uuid', name: 'Kaio Felipe', email: 'kaio@exemplo.com' },
  ],
  pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
};

function page(names: string[], current = 1, totalPages = 1) {
  return {
    data: names.map((name, index) => ({
      id: `${current}-${index}`,
      name,
      email: `${name.split(' ')[0].toLowerCase()}@exemplo.com`,
    })),
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
  const select = dialog.getByRole('combobox', { name: 'Conta' });

  return { dialog, select };
}

const JOAO = 'João Martins · joao@exemplo.com';

// Abre a lista do combobox e escolhe a conta pelo texto da opção.
async function chooseAccount(
  user: ReturnType<typeof userEvent.setup>,
  select: HTMLElement,
  option = JOAO,
) {
  await user.click(select);
  await user.click(await screen.findByRole('option', { name: option }));
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
    mockedUseSearchParams.mockReturnValue(new URLSearchParams());

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
      expect(items.getByText('maria@exemplo.com')).toBeInTheDocument();
      expect(items.getByText('Diego Alves')).toBeInTheDocument();
      expect(list).toHaveBeenCalledWith(
        PATIENTS_URL,
        expect.objectContaining({ credentials: 'include' }),
      );
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
        expect.objectContaining({ credentials: 'include' }),
      );
    });
  });

  describe('modal "Adicionar paciente"', () => {
    it('carrega as contas sem perfil de paciente nem profissional', async () => {
      const user = userEvent.setup();
      const { accounts } = mockApi();

      render(<PatientsPage />);

      const { select } = await openAddPatient(user);

      await user.click(select);

      const options = await screen.findAllByRole('option');

      expect(options.map((option) => option.textContent)).toEqual([
        JOAO,
        'Kaio Felipe · kaio@exemplo.com',
      ]);
      expect(accounts).toHaveBeenCalledWith(
        ACCOUNTS_URL,
        expect.objectContaining({ credentials: 'include' }),
      );
    });

    it('mostra o loading das contas enquanto carregam', async () => {
      const user = userEvent.setup();
      mockApi({ accounts: jest.fn(() => new Promise<Response>(() => {})) });

      render(<PatientsPage />);

      const { select } = await openAddPatient(user);

      await user.click(select);

      expect(await screen.findByText('Carregando contas...')).toBeVisible();
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

      const { select } = await openAddPatient(user);

      await user.click(select);

      expect(
        await screen.findByText('Nenhuma conta disponível.'),
      ).toBeVisible();
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

      const { dialog, select } = await openAddPatient(user);

      expect(
        await dialog.findByText('Não foi possível carregar as contas.'),
      ).toBeInTheDocument();

      await user.click(
        dialog.getByRole('button', { name: 'Tentar novamente' }),
      );
      await user.click(select);

      expect(
        await screen.findByRole('option', { name: JOAO }),
      ).toBeInTheDocument();
      expect(accounts).toHaveBeenCalledTimes(2);
    });

    it('mostra a message da API ao falhar a busca das contas', async () => {
      const user = userEvent.setup();
      mockApi({
        accounts: jest.fn().mockResolvedValue(
          mockResponse({
            status: 403,
            ok: false,
            data: {
              status: 'FORBIDDEN',
              message: 'Acesso restrito ao administrador.',
            },
          }),
        ),
      });

      render(<PatientsPage />);

      const { dialog } = await openAddPatient(user);

      expect(
        await dialog.findByText('Acesso restrito ao administrador.'),
      ).toBeInTheDocument();
    });

    it('redireciona para o login quando as contas respondem 401', async () => {
      const user = userEvent.setup();
      mockApi({
        accounts: jest
          .fn()
          .mockResolvedValue(mockResponse({ status: 401, ok: false })),
      });

      render(<PatientsPage />);

      await openAddPatient(user);

      await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    });

    it('explica a conta e os contatos em tooltips de ajuda', async () => {
      const user = userEvent.setup();
      mockApi();

      render(<PatientsPage />);

      const { dialog, select } = await openAddPatient(user);

      expect(select).toHaveAccessibleDescription(
        'Conta já cadastrada que passa a ser paciente. Busque por nome ou e-mail. Contas que já são pacientes ou profissionais não aparecem.',
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

      await chooseAccount(user, select);
      await user.click(dialog.getByRole('button', { name: 'Cancelar' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      const reopened = await openAddPatient(user);

      expect(reopened.select).toHaveValue('');
      expect(reopened.select).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('busca por nome ou e-mail em /patients', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    // Resposta da lista com o total igual ao número de nomes.
    function results(names: string[], current = 1, totalPages = 1) {
      return {
        data: names.map((name, index) => ({
          id: `${current}-${index}`,
          name,
          email: `${name.split(' ')[0].toLowerCase()}@exemplo.com`,
        })),
        pagination: {
          page: current,
          limit: 10,
          total: names.length,
          totalPages: names.length === 0 ? 0 : totalPages,
        },
      };
    }

    // A lista responde conforme o `q` da URL; sem `q`, usa a chave ''.
    function listByTerm(byTerm: Record<string, string[]>) {
      return jest.fn((url: string) => {
        const q = new URL(url).searchParams.get('q') ?? '';

        return Promise.resolve(
          mockResponse({ data: results(byTerm[q] ?? []) }),
        );
      });
    }

    const SEARCH = { name: 'Buscar por nome ou e-mail' };

    it('lê o termo da URL e busca com ele', async () => {
      mockedUseSearchParams.mockReturnValue(new URLSearchParams('q=maria'));
      const { list } = mockApi({
        list: listByTerm({ maria: ['Maria Sílvia'] }),
      });

      render(<PatientsPage />);

      expect(await screen.findByText('Maria Sílvia')).toBeInTheDocument();
      expect(screen.getByRole('searchbox', SEARCH)).toHaveValue('maria');
      expect(screen.getByText('1 paciente encontrado')).toBeInTheDocument();
      expect(list).toHaveBeenCalledWith(
        `${API}/accounts?isPatient=true&q=maria&page=1&limit=10`,
        expect.objectContaining({ credentials: 'include' }),
      );
    });

    it('busca 300 ms depois da última tecla e grava o termo na URL', async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const { list } = mockApi({
        list: listByTerm({
          '': ['Maria Sílvia', 'Diego Alves'],
          mar: ['Maria Sílvia'],
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
          `${API}/accounts?isPatient=true&q=mar&page=1&limit=10`,
          expect.anything(),
        ),
      );
      expect(replace).toHaveBeenCalledWith('/patients?q=mar', {
        scroll: false,
      });
      await waitFor(() =>
        expect(screen.queryByText('Diego Alves')).not.toBeInTheDocument(),
      );
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

    it('busca na hora ao pressionar Enter, sem esperar o debounce', async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const { list } = mockApi({
        list: listByTerm({ '': ['Diego Alves'], ana: ['Ana Lima'] }),
      });

      render(<PatientsPage />);

      await user.type(
        await screen.findByRole('searchbox', SEARCH),
        'ana{Enter}',
      );

      expect(await screen.findByText('Ana Lima')).toBeInTheDocument();
      expect(list).toHaveBeenLastCalledWith(
        `${API}/accounts?isPatient=true&q=ana&page=1&limit=10`,
        expect.anything(),
      );
    });

    it('limpa a busca com o Esc e com o ✕', async () => {
      const user = userEvent.setup();
      mockedUseSearchParams.mockReturnValue(new URLSearchParams('q=maria'));
      const { list } = mockApi({
        list: listByTerm({
          maria: ['Maria Sílvia'],
          '': ['Maria Sílvia', 'Diego Alves'],
        }),
      });

      render(<PatientsPage />);

      const box = await screen.findByRole('searchbox', SEARCH);

      await screen.findByText('Maria Sílvia');
      await user.type(box, '{Escape}');

      expect(box).toHaveValue('');
      expect(await screen.findByText('Diego Alves')).toBeInTheDocument();
      expect(replace).toHaveBeenLastCalledWith('/patients', { scroll: false });
      expect(list).toHaveBeenLastCalledWith(PATIENTS_URL, expect.anything());

      await user.type(box, 'diego{Enter}');
      await user.click(
        screen.getByRole('button', { name: 'Limpar campo de busca' }),
      );

      expect(box).toHaveValue('');
      expect(
        screen.queryByRole('button', { name: 'Limpar campo de busca' }),
      ).not.toBeInTheDocument();
    });

    it('mostra a mensagem própria sem resultados e limpa pelo botão', async () => {
      const user = userEvent.setup();
      mockedUseSearchParams.mockReturnValue(new URLSearchParams('q=zzz'));
      mockApi({ list: listByTerm({ '': ['Maria Sílvia'] }) });

      render(<PatientsPage />);

      expect(
        await screen.findByText('Nenhum paciente encontrado'),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Nenhum resultado para “zzz”/),
      ).toBeInTheDocument();
      expect(
        screen.queryByText('Nenhum paciente cadastrado'),
      ).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Limpar busca' }));

      expect(await screen.findByText('Maria Sílvia')).toBeInTheDocument();
      expect(screen.getByRole('searchbox', SEARCH)).toHaveValue('');
    });

    it('mantém os resultados anteriores enquanto a busca carrega', async () => {
      const user = userEvent.setup();
      const list = jest
        .fn()
        .mockResolvedValueOnce(
          mockResponse({ data: results(['Maria Sílvia']) }),
        )
        .mockImplementationOnce(() => new Promise<Response>(() => {}));

      mockApi({ list });
      render(<PatientsPage />);

      await screen.findByText('Maria Sílvia');
      await user.type(screen.getByRole('searchbox', SEARCH), 'ana{Enter}');

      expect(await screen.findByText('Buscando...')).toBeInTheDocument();
      expect(screen.getByText('Maria Sílvia')).toBeInTheDocument();
      expect(
        screen.getByRole('list', { name: 'Pacientes' }).parentElement,
      ).toHaveAttribute('aria-busy', 'true');
    });

    it('descarta a resposta de uma busca superada', async () => {
      const user = userEvent.setup();
      let resolveOld: (response: Response) => void = () => {};
      const list = jest.fn((url: string) => {
        const q = new URL(url).searchParams.get('q');

        if (q === 'ma') {
          return new Promise<Response>((resolve) => {
            resolveOld = resolve;
          });
        }

        return Promise.resolve(
          mockResponse({
            data: results(q === 'maria' ? ['Maria Sílvia'] : ['Diego Alves']),
          }),
        );
      });

      mockApi({ list });
      render(<PatientsPage />);

      const box = await screen.findByRole('searchbox', SEARCH);

      await screen.findByText('Diego Alves');
      await user.type(box, 'ma{Enter}');
      await user.type(box, 'ria{Enter}');

      expect(await screen.findByText('Maria Sílvia')).toBeInTheDocument();

      await act(async () => {
        resolveOld(mockResponse({ data: results(['Resposta velha']) }));
      });

      expect(screen.getByText('Maria Sílvia')).toBeInTheDocument();
      expect(screen.queryByText('Resposta velha')).not.toBeInTheDocument();
    });

    it('volta à página 1 quando o termo muda', async () => {
      const user = userEvent.setup();
      const list = jest.fn((url: string) => {
        const params = new URL(url).searchParams;
        const current = Number(params.get('page'));

        return Promise.resolve(
          mockResponse({
            data: results(
              [params.get('q') ? 'Ana Lima' : `Paciente ${current}`],
              current,
              2,
            ),
          }),
        );
      });

      mockApi({ list });
      render(<PatientsPage />);

      await screen.findByText('Página 1 de 2');
      await user.click(screen.getByRole('button', { name: 'Próxima' }));
      await screen.findByText('Página 2 de 2');
      await user.type(screen.getByRole('searchbox', SEARCH), 'ana{Enter}');

      expect(await screen.findByText('Ana Lima')).toBeInTheDocument();
      expect(screen.getByText('Página 1 de 2')).toBeInTheDocument();
      expect(list).toHaveBeenLastCalledWith(
        `${API}/accounts?isPatient=true&q=ana&page=1&limit=10`,
        expect.anything(),
      );
    });

    it('mostra o bloqueio de admin quando a lista responde 403', async () => {
      mockApi({
        list: jest.fn().mockResolvedValue(
          mockResponse({
            status: 403,
            ok: false,
            data: {
              status: 'FORBIDDEN',
              message: 'Acesso restrito ao administrador.',
            },
          }),
        ),
      });

      render(<PatientsPage />);

      expect(
        await screen.findByText('Acesso restrito ao administrador'),
      ).toBeInTheDocument();
    });

    it('mostra a message da API quando a lista falha', async () => {
      mockApi({
        list: jest.fn().mockResolvedValue(
          mockResponse({
            status: 500,
            ok: false,
            data: {
              status: 'ERROR',
              message: 'Não foi possível consultar as contas.',
            },
          }),
        ),
      });

      render(<PatientsPage />);

      expect(
        await screen.findByText('Não foi possível consultar as contas.'),
      ).toBeInTheDocument();
    });
  });

  describe('combobox "Conta" do modal', () => {
    // O `q` do modal escolhe a resposta; sem `q`, as contas da 1ª página.
    function accountsByTerm(byTerm: Record<string, AccountSeed[]>) {
      return jest.fn((url: string) => {
        const q = new URL(url).searchParams.get('q') ?? '';
        const data = q ? (byTerm[q] ?? []) : ACCOUNTS.data;

        return Promise.resolve(
          mockResponse({
            data: {
              data,
              pagination: {
                page: 1,
                limit: 20,
                total: data.length,
                totalPages: data.length === 0 ? 0 : 1,
              },
            },
          }),
        );
      });
    }

    type AccountSeed = { id: string; name: string; email: string };

    const ANA: AccountSeed = {
      id: 'ana-uuid',
      name: 'Ana Souza',
      email: 'ana@exemplo.com',
    };

    it('encontra por e-mail uma conta fora da 1ª página e a seleciona', async () => {
      const user = userEvent.setup();
      const { accounts, patients } = mockApi({
        accounts: accountsByTerm({ 'ana@': [ANA] }),
        patients: jest
          .fn()
          .mockResolvedValue(mockResponse({ status: 201, data: {} })),
      });

      render(<PatientsPage />);

      const { dialog, select } = await openAddPatient(user);

      await user.type(select, 'ana@');

      await chooseAccount(user, select, 'Ana Souza · ana@exemplo.com');

      expect(accounts).toHaveBeenCalledWith(
        `${API}/accounts?isPatient=false&isProfessional=false&q=ana%40&page=1&limit=20`,
        expect.anything(),
      );
      expect(select).toHaveValue('Ana Souza · ana@exemplo.com');
      expect(select).toHaveAttribute('aria-expanded', 'false');

      await user.click(
        dialog.getByRole('button', { name: 'Adicionar paciente' }),
      );

      expect(patients).toHaveBeenCalledWith(
        `${API}/patients`,
        expect.objectContaining({
          body: JSON.stringify({ accountId: 'ana-uuid', supportContacts: [] }),
        }),
      );
      expect(
        await screen.findByText('Paciente Ana Souza adicionado.'),
      ).toBeInTheDocument();
    });

    it('expõe os papéis ARIA do combobox e da lista', async () => {
      const user = userEvent.setup();
      mockApi();

      render(<PatientsPage />);

      const { select } = await openAddPatient(user);

      expect(select).toHaveAttribute('aria-autocomplete', 'list');
      expect(select).toHaveAttribute('aria-expanded', 'false');

      await user.click(select);

      const listbox = await screen.findByRole('listbox', {
        name: 'Contas disponíveis',
      });

      expect(select).toHaveAttribute('aria-expanded', 'true');
      expect(select).toHaveAttribute('aria-controls', listbox.id);
    });

    it('navega por setas, escolhe com Enter e fecha com Esc', async () => {
      const user = userEvent.setup();
      mockApi();

      render(<PatientsPage />);

      const { select } = await openAddPatient(user);

      await user.click(select);
      await screen.findByRole('listbox');
      await user.keyboard('{ArrowDown}');

      const options = screen.getAllByRole('option');

      expect(select).toHaveAttribute('aria-activedescendant', options[0].id);

      await user.keyboard('{ArrowDown}');

      expect(select).toHaveAttribute('aria-activedescendant', options[1].id);

      await user.keyboard('{ArrowUp}{ArrowUp}');

      expect(select).toHaveAttribute('aria-activedescendant', options[1].id);

      await user.keyboard('{Enter}');

      expect(select).toHaveValue('Kaio Felipe · kaio@exemplo.com');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

      await user.clear(select);
      await user.click(select);
      await screen.findByRole('listbox');
      await user.keyboard('{Escape}');

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      // O Esc fecha só a lista, não o modal.
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('mostra a mensagem própria sem resultados e limpa a busca', async () => {
      const user = userEvent.setup();
      mockApi({ accounts: accountsByTerm({ zzz: [] }) });

      render(<PatientsPage />);

      const { dialog, select } = await openAddPatient(user);

      await user.type(select, 'zzz');

      expect(
        await screen.findByText('Nenhuma conta encontrada para “zzz”.'),
      ).toBeInTheDocument();

      await user.click(dialog.getByRole('button', { name: 'Limpar busca' }));

      expect(select).toHaveValue('');
      expect(
        await screen.findByRole('option', { name: JOAO }),
      ).toBeInTheDocument();
    });

    it('limpa a conta escolhida pelo ✕', async () => {
      const user = userEvent.setup();
      mockApi();

      render(<PatientsPage />);

      const { dialog, select } = await openAddPatient(user);

      await chooseAccount(user, select);
      await user.click(
        dialog.getByRole('button', { name: 'Limpar campo da conta' }),
      );

      expect(select).toHaveValue('');
    });

    it('avisa e não busca com menos de 2 caracteres', async () => {
      const user = userEvent.setup();
      const { accounts } = mockApi();

      render(<PatientsPage />);

      const { select } = await openAddPatient(user);

      await user.type(select, 'a');

      expect(
        await screen.findByText('Digite ao menos 2 caracteres para buscar.'),
      ).toBeInTheDocument();

      await new Promise((resolve) => setTimeout(resolve, 400));

      expect(accounts).toHaveBeenCalledTimes(1);
    });

    it('descarta a resposta de uma busca superada', async () => {
      const user = userEvent.setup();
      let resolveOld: (response: Response) => void = () => {};
      const accounts = jest.fn((url: string) => {
        const q = new URL(url).searchParams.get('q');

        if (q === 'an') {
          return new Promise<Response>((resolve) => {
            resolveOld = resolve;
          });
        }

        return Promise.resolve(
          mockResponse({
            data: {
              data: q === 'ana' ? [ANA] : ACCOUNTS.data,
              pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
            },
          }),
        );
      });

      mockApi({ accounts });
      render(<PatientsPage />);

      const { select } = await openAddPatient(user);

      await user.type(select, 'an{Enter}');
      await user.type(select, 'a{Enter}');

      expect(
        await screen.findByRole('option', {
          name: 'Ana Souza · ana@exemplo.com',
        }),
      ).toBeInTheDocument();

      await act(async () => {
        resolveOld(
          mockResponse({
            data: {
              data: [{ id: 'old', name: 'Velha', email: 'velha@exemplo.com' }],
              pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
            },
          }),
        );
      });

      expect(
        screen.getByRole('option', { name: 'Ana Souza · ana@exemplo.com' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('option', { name: /Velha/ }),
      ).not.toBeInTheDocument();
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

      await chooseAccount(user, select);
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

      await chooseAccount(user, select);
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

      await chooseAccount(user, select);
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

      await chooseAccount(user, select);
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

      await chooseAccount(user, select);
      await user.click(
        dialog.getByRole('button', { name: 'Adicionar paciente' }),
      );

      await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    });
  });
});
