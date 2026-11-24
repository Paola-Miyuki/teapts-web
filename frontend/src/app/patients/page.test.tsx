import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useRouter, useSearchParams } from 'next/navigation';

import type { Account } from '@/lib/account';

import PatientsPage from './page';
import { personalData } from '@/test-utils/account';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

const mockedUseRouter = useRouter as jest.Mock;
const mockedUseSearchParams = useSearchParams as jest.Mock;

const API = 'http://localhost:3000';
const PATIENTS_URL = `${API}/patients/authorized?page=1&limit=10`;
const ACCOUNTS_URL = `${API}/accounts?isPatient=false&isProfessional=false&page=1&limit=20`;

const ACCOUNT_ID = '0b6f5a4e-2c1d-4e8f-9a7b-3c2d1e0f9a8b';

const PROFESSIONAL: Account = {
  accountId: 'professional-uuid',
  name: 'Paula Profissional',
  email: 'paula@example.com',
  role: 'user',
  ...personalData,
  patientProfileId: null,
  professionalProfileIds: ['professional-profile'],
};

const ADMIN: Account = {
  accountId: 'admin-uuid',
  name: 'Ana Admin',
  email: 'admin@example.com',
  role: 'admin',
  ...personalData,
  patientProfileId: null,
  professionalProfileIds: [],
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
      socialName: null,
      email: `${name.split(' ')[0].toLowerCase()}@exemplo.com`,
      cns: index === 0 ? '700001234567891' : null,
      guardianName: index === 0 ? 'Juliana Ribeiro' : null,
      registeredAt: '2026-02-14T12:00:00.000Z',
      ptsStatus: index === 0 ? 'running' : null,
      activePtsId: index === 0 ? 'pts-1' : null,
      readOnly: false,
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

      if (url.startsWith(`${API}/patients/authorized`)) {
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
    it('bloqueia quem não é admin nem profissional sem chamar a lista', async () => {
      mockApi({ account: { ...ADMIN, role: 'user' } });

      render(<PatientsPage />);

      expect(await screen.findByText('Acesso restrito')).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Adicionar paciente' }),
      ).not.toBeInTheDocument();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('mostra as colunas do layout para o admin', async () => {
      const { list } = mockApi();

      render(<PatientsPage />);

      const table = within(await screen.findByRole('table'));

      expect(
        table.getAllByRole('columnheader').map((cell) => cell.textContent),
      ).toEqual([
        'Paciente',
        'E-mail',
        'CNS',
        'Responsável tutelar',
        'Status do PTS',
        'Cadastrado em',
        'Ações',
      ]);
      expect(table.getByText('Maria Sílvia')).toBeInTheDocument();
      expect(table.getByText('maria@exemplo.com')).toBeInTheDocument();
      expect(table.getByText('700 0012 3456 7891')).toBeInTheDocument();
      expect(table.getByText('Juliana Ribeiro')).toBeInTheDocument();
      expect(table.getByText('Em andamento')).toHaveClass('badge', 'running');
      expect(table.getByText('Sem PTS')).toHaveClass('badge', 'none');
      expect(table.getAllByText('14/02/2026')).toHaveLength(2);
      expect(
        table.queryByRole('link', { name: 'Maria Sílvia' }),
      ).not.toBeInTheDocument();
      expect(screen.getByText('Pacientes cadastrados')).toBeInTheDocument();
      expect(list).toHaveBeenCalledWith(
        PATIENTS_URL,
        expect.objectContaining({ credentials: 'include' }),
      );
    });

    it('abre o paciente pelo "Visualizar" do menu', async () => {
      const user = userEvent.setup();
      mockApi();

      render(<PatientsPage />);

      await user.click(
        await screen.findByRole('button', { name: 'Ações para Maria Sílvia' }),
      );

      expect(
        screen.getByRole('menuitem', { name: 'Visualizar' }),
      ).toHaveAttribute('href', '/patients/1-0');
    });

    it('mostra ao profissional os pacientes vinculados e o filtro do papel', async () => {
      const user = userEvent.setup();
      mockApi({ account: PROFESSIONAL });

      render(<PatientsPage />);

      expect(
        await screen.findByText('Pacientes vinculados'),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'Criar proposta de PTS' }),
      ).toHaveAttribute('href', '/pts/novo');
      expect(
        screen.queryByRole('button', { name: 'Adicionar paciente' }),
      ).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Filtros' }));

      expect(
        screen
          .getAllByRole('checkbox')
          .map((box) => box.parentElement?.textContent),
      ).toEqual(['Em planejamento', 'Em andamento', 'Concluído', 'Cancelado']);
    });

    it('mostra o vazio sem pacientes e o erro com nova tentativa', async () => {
      const user = userEvent.setup();
      const list = jest
        .fn()
        .mockResolvedValueOnce(
          mockResponse({
            status: 500,
            ok: false,
            data: { status: 'ERROR', message: 'Falha ao consultar.' },
          }),
        )
        .mockResolvedValue(mockResponse({ data: page([]) }));
      mockApi({ list });

      render(<PatientsPage />);

      expect(
        await screen.findByText('Falha ao consultar.'),
      ).toBeInTheDocument();

      await user.click(
        screen.getByRole('button', { name: 'Tentar novamente' }),
      );

      expect(
        await screen.findByText('Nenhum paciente cadastrado'),
      ).toBeInTheDocument();
    });

    it('redireciona para o login quando a sessão expira', async () => {
      mockApi({
        list: jest
          .fn()
          .mockResolvedValue(mockResponse({ status: 401, ok: false })),
      });

      render(<PatientsPage />);

      await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    });
  });

  describe('modal "Adicionar paciente"', () => {
    it('carrega as contas sem perfil de paciente nem profissional', async () => {
      const user = userEvent.setup();
      const { accounts } = mockApi();

      render(<PatientsPage />);

      const { select } = await openAddPatient(user);

      await user.click(select);

      const options = await within(
        await screen.findByRole('listbox'),
      ).findAllByRole('option');

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
        'Pessoas que ajudam no cuidado. Não acessam o sistema nem os dados clínicos.',
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

  describe('busca, filtros, ordenação e paginação na URL', () => {
    it('carrega a busca, os filtros e a ordenação da URL', async () => {
      mockedUseSearchParams.mockReturnValue(
        new URLSearchParams(
          'q=mari&status=running,none&registered=custom&registeredFrom=2026-01-01&registeredTo=2026-02-01&sort=registeredAt&order=desc&page=2&limit=25',
        ),
      );
      const { list } = mockApi();

      render(<PatientsPage />);

      await screen.findByRole('table');

      expect(list).toHaveBeenCalledWith(
        `${API}/patients/authorized?q=mari&status=running%2Cnone&registeredFrom=2026-01-01&registeredTo=2026-02-01&sort=registeredAt&order=desc&page=2&limit=25`,
        expect.anything(),
      );
      expect(screen.getByRole('searchbox')).toHaveValue('mari');
      expect(screen.getByLabelText('Ordenar por')).toHaveValue('registeredAt');
      expect(
        screen.getByRole('button', { name: 'Ordem decrescente' }),
      ).toBeInTheDocument();
      expect(screen.getByText(/com os filtros atuais/)).toBeInTheDocument();
    });

    it('grava a busca em q, depois do debounce', async () => {
      const user = userEvent.setup();
      mockApi();

      render(<PatientsPage />);
      await screen.findByRole('table');

      await user.type(screen.getByRole('searchbox'), 'diego{Enter}');

      expect(replace).toHaveBeenCalledWith('/patients?q=diego', {
        scroll: false,
      });
    });

    it('grava o status escolhido e limpa os filtros', async () => {
      const user = userEvent.setup();
      mockApi();

      render(<PatientsPage />);
      await screen.findByRole('table');

      await user.click(screen.getByRole('button', { name: 'Filtros' }));
      await user.click(screen.getByRole('checkbox', { name: 'Concluído' }));

      expect(replace).toHaveBeenLastCalledWith('/patients?status=concluded', {
        scroll: false,
      });
    });

    it('mostra Limpar só com filtro além da busca', async () => {
      const user = userEvent.setup();
      mockedUseSearchParams.mockReturnValue(
        new URLSearchParams('q=mari&status=draft'),
      );
      mockApi();

      render(<PatientsPage />);
      await screen.findByRole('table');

      await user.click(screen.getByRole('button', { name: 'Limpar' }));

      expect(replace).toHaveBeenLastCalledWith('/patients?q=mari', {
        scroll: false,
      });
    });

    it('ordena por data de cadastro e inverte a ordem', async () => {
      const user = userEvent.setup();
      mockApi();

      render(<PatientsPage />);
      await screen.findByRole('table');

      await user.selectOptions(
        screen.getByLabelText('Ordenar por'),
        'registeredAt',
      );
      expect(replace).toHaveBeenLastCalledWith('/patients?sort=registeredAt', {
        scroll: false,
      });

      await user.click(screen.getByRole('button', { name: 'Ordem crescente' }));
      expect(replace).toHaveBeenLastCalledWith('/patients?order=desc', {
        scroll: false,
      });
    });

    it('troca de página mantendo os filtros', async () => {
      const user = userEvent.setup();
      mockedUseSearchParams.mockReturnValue(
        new URLSearchParams('status=running'),
      );
      mockApi({
        list: jest
          .fn()
          .mockResolvedValue(
            mockResponse({ data: page(['Maria Sílvia'], 1, 3) }),
          ),
      });

      render(<PatientsPage />);
      await screen.findByRole('table');

      expect(screen.getByText('Mostrando 1–10 de 30')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Próxima página' }));

      expect(replace).toHaveBeenLastCalledWith(
        '/patients?status=running&page=2',
        { scroll: false },
      );
    });
  });

  describe('conta pré-selecionada (Tornar paciente em Contas)', () => {
    it('abre o modal com a conta da URL e tira o parâmetro ao fechar', async () => {
      const user = userEvent.setup();
      mockedUseSearchParams.mockReturnValue(
        new URLSearchParams(`account=${ACCOUNT_ID}&q=ana`),
      );
      mockApi({
        accounts: jest.fn().mockResolvedValue(
          mockResponse({
            data: {
              id: ACCOUNT_ID,
              fullName: 'João Martins',
              email: 'joao@exemplo.com',
            },
          }),
        ),
      });

      render(<PatientsPage />);

      const dialog = within(await screen.findByRole('dialog'));

      expect(
        await dialog.findByRole('combobox', { name: 'Conta' }),
      ).toHaveValue(JOAO);

      await user.click(dialog.getByRole('button', { name: 'Cancelar' }));

      expect(replace).toHaveBeenCalledWith('/patients?q=ana', {
        scroll: false,
      });
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

      const options = within(screen.getByRole('listbox')).getAllByRole(
        'option',
      );

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

    it('mostra a mensagem própria sem resultados e limpa pelo ✕', async () => {
      const user = userEvent.setup();
      mockApi({ accounts: accountsByTerm({ zzz: [] }) });

      render(<PatientsPage />);

      const { dialog, select } = await openAddPatient(user);

      await user.type(select, 'zzz');

      expect(
        await screen.findByText('Nenhuma conta encontrada para “zzz”.'),
      ).toBeInTheDocument();

      await user.click(
        dialog.getByRole('button', { name: 'Limpar campo da conta' }),
      );

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

    it('exige e-mail ou telefone', async () => {
      const user = userEvent.setup();
      mockApi();

      render(<PatientsPage />);
      await openAddPatient(user);

      await addContact(user, { name: 'Maria' });

      expect(
        within(
          screen.getByRole('group', { name: 'Novo contato de suporte' }),
        ).getByRole('alert'),
      ).toHaveTextContent('Informe o e-mail ou o telefone do contato.');
    });

    it('exige o telefone no contato de emergência', async () => {
      const user = userEvent.setup();
      mockApi();

      render(<PatientsPage />);
      const { dialog } = await openAddPatient(user);

      await user.click(
        dialog.getByRole('button', { name: 'Adicionar contato' }),
      );
      await user.type(dialog.getByLabelText('Nome do contato'), 'Maria');
      await user.type(dialog.getByLabelText(/E-mail/), 'maria@exemplo.com');
      await user.click(dialog.getByLabelText('Contato de emergência'));
      await user.click(dialog.getByRole('button', { name: 'Salvar contato' }));

      expect(
        within(
          screen.getByRole('group', { name: 'Novo contato de suporte' }),
        ).getByRole('alert'),
      ).toHaveTextContent('Informe o telefone do contato de emergência.');
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

      await addContact(user, { name: 'Maria Martins', phone: '11987654321' });

      const list = within(
        screen.getByRole('list', { name: 'Contatos de suporte' }),
      );

      expect(list.getAllByText('Não informado')).toHaveLength(2);
    });

    it('exclui o contato sem fechar o modal', async () => {
      const user = userEvent.setup();
      mockApi();

      render(<PatientsPage />);
      const { dialog } = await openAddPatient(user);

      await user.click(
        dialog.getByRole('button', { name: 'Adicionar contato' }),
      );
      await user.type(dialog.getByLabelText('Nome do contato'), 'Maria');
      await user.click(dialog.getByRole('button', { name: 'Excluir contato' }));

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
      await user.type(dialog.getByLabelText('Nome do contato'), 'Maria');
      await user.type(dialog.getByLabelText(/Telefone/), '11987654321{Enter}');

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
