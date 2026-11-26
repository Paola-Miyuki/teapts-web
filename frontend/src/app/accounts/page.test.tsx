import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useRouter, useSearchParams } from 'next/navigation';

import type { Account } from '@/lib/account';
import { personalData } from '@/test-utils/account';

import AccountsPage from './page';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

const API = 'http://localhost:3000';
const replace = jest.fn();

const ADMIN: Account = {
  accountId: 'admin-uuid',
  name: 'Ana Admin',
  email: 'admin@example.com',
  role: 'admin',
  ...personalData,
  patientProfileId: null,
  professionalProfileIds: [],
};

const item = (overrides: Record<string, unknown>) => ({
  id: 'id',
  name: 'Nome',
  socialName: null,
  email: 'nome@exemplo.com',
  cpf: '52998224725',
  role: 'user',
  profile: 'none',
  specialisms: [],
  status: 'active',
  createdAt: '2026-11-10T12:00:00.000Z',
  ...overrides,
});

const LIST = {
  data: [
    item({
      id: 'a1',
      name: 'Ana Souza',
      email: 'ana@exemplo.com',
      profile: 'professional',
      specialisms: ['psychologist'],
    }),
    item({ id: 'b2', name: 'Bruno Takeda', email: 'bruno@exemplo.com' }),
    item({
      id: 'k3',
      name: 'Kaio Admin',
      email: 'kaio@exemplo.com',
      cpf: null,
      role: 'admin',
      profile: 'admin',
    }),
    item({
      id: 'm4',
      name: 'Marcos Vieira',
      email: 'marcos@exemplo.com',
      profile: 'patient',
      status: 'inactive',
    }),
  ],
  pagination: { page: 1, limit: 10, total: 42, totalPages: 5 },
};

const DETAIL = {
  id: 'b2',
  fullName: 'Bruno Takeda da Silva',
  socialName: null,
  birthDate: '1992-02-27',
  sex: 'male',
  gender: 'cis_man',
  cpf: '25814736952',
  email: 'bruno@exemplo.com',
  phone: '41984441020',
  role: 'user',
  status: 'active',
  createdAt: '2026-11-10T12:00:00.000Z',
  updatedAt: null,
  profile: { type: 'none', specialisms: [] },
};

function res(data: unknown, status = 200) {
  return {
    ok: status < 300,
    status,
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response;
}

function mockApi({
  account = ADMIN,
  list = LIST as unknown,
  detail = DETAIL as unknown,
  remove = res({ id: 'b2', status: 'inactive', deactivatedAt: 'x' }),
}: {
  account?: Account;
  list?: unknown;
  detail?: unknown;
  remove?: Response;
} = {}) {
  (global.fetch as jest.Mock).mockImplementation(
    (url: string, init?: RequestInit) => {
      if (url.endsWith('/me')) {
        return Promise.resolve(res(account));
      }

      if (init?.method === 'DELETE') {
        return Promise.resolve(remove);
      }

      if (url.startsWith(`${API}/accounts?`)) {
        return Promise.resolve(res(list));
      }

      return Promise.resolve(res(detail));
    },
  );
}

function listCalls() {
  return (global.fetch as jest.Mock).mock.calls
    .map(([url]) => url as string)
    .filter((url) => url.startsWith(`${API}/accounts?`));
}

async function openMenu(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.click(
    await screen.findByRole('button', { name: `Ações para ${name}` }),
  );

  return within(screen.getByRole('menu'));
}

describe('AccountsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace });
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams());
    global.fetch = jest.fn();
  });

  it('bloqueia quem não é admin sem chamar a lista', async () => {
    mockApi({ account: { ...ADMIN, role: 'user' } });

    render(<AccountsPage />);

    expect(await screen.findByText('Acesso restrito')).toBeInTheDocument();
    expect(listCalls()).toHaveLength(0);
  });

  it('mostra as colunas e os dados do layout', async () => {
    mockApi();

    render(<AccountsPage />);

    const table = within(await screen.findByRole('table'));

    expect(
      table.getAllByRole('columnheader').map((cell) => cell.textContent),
    ).toEqual([
      'Conta',
      'E-mail',
      'CPF',
      'Perfil',
      'Situação',
      'Criada em',
      'Ações',
    ]);
    expect(table.getByText('Ana Souza')).toBeInTheDocument();
    expect(table.getAllByText('529.982.247-25').length).toBeGreaterThan(0);
    expect(table.getByText('Profissional: Psicologia')).toBeInTheDocument();
    expect(table.getByText('Sem perfil')).toHaveClass('badge', 'none');
    expect(table.getByText('Administrador')).toBeInTheDocument();
    expect(table.getByText('Inativa')).toHaveClass('badge', 'inactive');
    expect(table.getAllByText('10/11/2026').length).toBeGreaterThan(0);
    expect(screen.getByText('42 contas')).toBeInTheDocument();
    expect(listCalls()[0]).toBe(`${API}/accounts?page=1&limit=10`);
  });

  it('envia os filtros, a ordenação e a página da URL', async () => {
    (useSearchParams as jest.Mock).mockReturnValue(
      new URLSearchParams(
        'q=ana&profile=none,patient&status=inactive&created=custom&createdFrom=2026-01-01&createdTo=2026-02-01&sort=createdAt&order=desc&page=2&limit=25',
      ),
    );
    mockApi();

    render(<AccountsPage />);

    await screen.findByRole('table');

    expect(listCalls()[0]).toBe(
      `${API}/accounts?q=ana&profile=none%2Cpatient&status=inactive&createdFrom=2026-01-01&createdTo=2026-02-01&sort=createdAt&order=desc&page=2&limit=25`,
    );
    expect(screen.getByRole('button', { name: 'Limpar' })).toBeInTheDocument();
  });

  it('grava filtro e ordenação na URL e limpa os filtros', async () => {
    const user = userEvent.setup();
    mockApi();

    const view = render(<AccountsPage />);

    await screen.findByRole('table');
    expect(
      screen.queryByRole('button', { name: 'Limpar' }),
    ).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Situação'), 'inactive');
    expect(replace).toHaveBeenLastCalledWith('/accounts?status=inactive', {
      scroll: false,
    });

    await user.selectOptions(
      screen.getByLabelText('Ordenar por'),
      'Data de criação',
    );
    expect(replace).toHaveBeenLastCalledWith('/accounts?sort=createdAt', {
      scroll: false,
    });

    await user.click(screen.getByRole('button', { name: 'Ordem crescente' }));
    expect(replace).toHaveBeenLastCalledWith('/accounts?order=desc', {
      scroll: false,
    });

    (useSearchParams as jest.Mock).mockReturnValue(
      new URLSearchParams('status=inactive&profile=admin&q=ana'),
    );
    view.rerender(<AccountsPage />);

    await user.click(await screen.findByRole('button', { name: 'Limpar' }));
    expect(replace).toHaveBeenLastCalledWith('/accounts?q=ana', {
      scroll: false,
    });
  });

  it('busca com debounce e limpa com Esc', async () => {
    const user = userEvent.setup();
    mockApi();

    render(<AccountsPage />);

    const input = await screen.findByRole('searchbox');
    await user.type(input, 'ana');

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/accounts?q=ana', {
        scroll: false,
      }),
    );

    await user.keyboard('{Escape}');
    expect(input).toHaveValue('');
  });

  it('muda de página e de itens por página pela URL', async () => {
    const user = userEvent.setup();
    mockApi();

    render(<AccountsPage />);

    await user.click(await screen.findByRole('button', { name: 'Página 2' }));
    expect(replace).toHaveBeenLastCalledWith('/accounts?page=2', {
      scroll: false,
    });

    await user.selectOptions(screen.getByLabelText('Itens por página'), '25');
    expect(replace).toHaveBeenLastCalledWith('/accounts?limit=25', {
      scroll: false,
    });
  });

  it('mostra o vazio e o erro com a mensagem da API', async () => {
    mockApi({
      list: {
        data: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      },
    });

    const view = render(<AccountsPage />);

    expect(
      await screen.findByText('Nenhuma conta encontrada'),
    ).toBeInTheDocument();
    view.unmount();

    (global.fetch as jest.Mock).mockImplementation((url: string) =>
      Promise.resolve(
        url.endsWith('/me')
          ? res(ADMIN)
          : res({ status: 'FORBIDDEN', message: 'Sem permissão.' }, 403),
      ),
    );

    render(<AccountsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sem permissão.',
    );
  });

  it('cancela a consulta anterior ao mudar a busca', async () => {
    const signals: AbortSignal[] = [];
    mockApi();
    const base = (global.fetch as jest.Mock).getMockImplementation()!;
    (global.fetch as jest.Mock).mockImplementation(
      (url: string, init?: RequestInit) => {
        if (url.startsWith(`${API}/accounts?`) && init?.signal) {
          signals.push(init.signal);
        }

        return base(url, init);
      },
    );

    const view = render(<AccountsPage />);
    await screen.findByRole('table');

    (useSearchParams as jest.Mock).mockReturnValue(
      new URLSearchParams('status=active'),
    );
    view.rerender(<AccountsPage />);

    await waitFor(() => expect(signals).toHaveLength(2));
    expect(signals[0].aborted).toBe(true);
  });

  describe('ações por perfil', () => {
    it('conta sem perfil: paciente leva à tela de pacientes e profissional fica desabilitado', async () => {
      const user = userEvent.setup();
      mockApi();

      render(<AccountsPage />);

      const menu = await openMenu(user, 'Bruno Takeda');

      expect(
        menu.getByRole('menuitem', { name: 'Tornar paciente' }),
      ).toHaveAttribute('href', '/patients?account=b2');
      expect(
        menu.getByRole('menuitem', { name: 'Tornar profissional' }),
      ).toBeDisabled();
      expect(menu.getByRole('menuitem', { name: 'Desativar' })).toHaveClass(
        'danger',
      );
    });

    it('conta com perfil não tem as ações de tornar; admin mostra o aviso', async () => {
      const user = userEvent.setup();
      mockApi();

      render(<AccountsPage />);

      let menu = await openMenu(user, 'Ana Souza');
      expect(
        menu.queryByRole('menuitem', { name: 'Tornar paciente' }),
      ).not.toBeInTheDocument();
      await user.keyboard('{Escape}');

      menu = await openMenu(user, 'Kaio Admin');
      expect(menu.getByText(/não recebe perfil/)).toBeInTheDocument();
      expect(
        menu.queryByRole('menuitem', { name: 'Tornar paciente' }),
      ).not.toBeInTheDocument();
    });

    it('conta inativa só tem Visualizar', async () => {
      const user = userEvent.setup();
      mockApi();

      render(<AccountsPage />);

      const menu = await openMenu(user, 'Marcos Vieira');

      expect(menu.getAllByRole('menuitem')).toHaveLength(1);
      expect(menu.getByRole('menuitem', { name: 'Visualizar' })).toBeVisible();
    });
  });

  describe('modal Dados da conta', () => {
    it('mostra os dados formatados e as ações de conta sem perfil', async () => {
      const user = userEvent.setup();
      mockApi();

      render(<AccountsPage />);

      await user.click(
        await (
          await openMenu(user, 'Bruno Takeda')
        ).findByRole('menuitem', {
          name: 'Visualizar',
        }),
      );

      const dialog = within(
        await screen.findByRole('dialog', { name: 'Bruno Takeda' }),
      );

      expect(
        await dialog.findByText('Bruno Takeda da Silva'),
      ).toBeInTheDocument();
      expect(dialog.getByText('27/02/1992')).toBeInTheDocument();
      expect(dialog.getByText('Masculino')).toBeInTheDocument();
      expect(dialog.getByText('Homem cisgênero')).toBeInTheDocument();
      expect(dialog.getByText('258.147.369-52')).toBeInTheDocument();
      expect(dialog.getByText('(41) 98444-1020')).toBeInTheDocument();
      expect(dialog.getByText('Usuário')).toBeInTheDocument();
      expect(dialog.getByText('Ativa')).toHaveClass('badge', 'active');
      expect(dialog.getAllByLabelText('Não informado').length).toBe(2);
      expect(
        dialog.getByText('Esta conta ainda não tem perfil.'),
      ).toBeInTheDocument();
      expect(
        dialog.getByRole('link', { name: 'Tornar paciente' }),
      ).toHaveAttribute('href', '/patients?account=b2');
      expect(
        dialog.getByRole('button', { name: 'Tornar profissional' }),
      ).toBeDisabled();
      expect(dialog.getByRole('button', { name: 'Desativar' })).toHaveClass(
        'btn-danger',
      );
    });

    it('conta com perfil mostra "Ver na lista"', async () => {
      const user = userEvent.setup();
      mockApi({
        detail: {
          ...DETAIL,
          id: 'a1',
          profile: { type: 'professional', specialisms: ['doctor'] },
        },
      });

      render(<AccountsPage />);

      await user.click(
        await (
          await openMenu(user, 'Ana Souza')
        ).findByRole('menuitem', {
          name: 'Visualizar',
        }),
      );

      const dialog = within(await screen.findByRole('dialog'));

      expect(
        await dialog.findByText('Profissional: Medicina'),
      ).toBeInTheDocument();
      expect(
        dialog.getByRole('link', { name: 'Ver na lista' }),
      ).toHaveAttribute('href', '/professionals?q=bruno%40exemplo.com');
    });

    it('mostra o erro da API ao não carregar', async () => {
      const user = userEvent.setup();
      mockApi({
        detail: {
          status: 'ACCOUNT_NOT_FOUND',
          message: 'Conta não encontrada.',
        },
      });
      const base = (global.fetch as jest.Mock).getMockImplementation()!;
      (global.fetch as jest.Mock).mockImplementation(
        (url: string, init?: RequestInit) =>
          url === `${API}/accounts/b2`
            ? Promise.resolve(
                res(
                  {
                    status: 'ACCOUNT_NOT_FOUND',
                    message: 'Conta não encontrada.',
                  },
                  404,
                ),
              )
            : base(url, init),
      );

      render(<AccountsPage />);

      await user.click(
        await (
          await openMenu(user, 'Bruno Takeda')
        ).findByRole('menuitem', {
          name: 'Visualizar',
        }),
      );

      expect(
        await within(await screen.findByRole('dialog')).findByRole('alert'),
      ).toHaveTextContent('Conta não encontrada.');
    });
  });

  describe('desativar', () => {
    async function openDeactivate(user: ReturnType<typeof userEvent.setup>) {
      const menu = await openMenu(user, 'Bruno Takeda');
      await user.click(menu.getByRole('menuitem', { name: 'Desativar' }));

      return within(
        await screen.findByRole('dialog', {
          name: 'Desativar a conta de Bruno Takeda?',
        }),
      );
    }

    it('confirma e atualiza a linha para Inativa', async () => {
      const user = userEvent.setup();
      mockApi();

      render(<AccountsPage />);

      const dialog = await openDeactivate(user);
      expect(
        dialog.getByRole('button', { name: 'Desativar conta' }),
      ).toHaveClass('btn-danger');
      await user.click(dialog.getByRole('button', { name: 'Desativar conta' }));

      expect(
        await screen.findByText('Conta de Bruno Takeda desativada'),
      ).toBeInTheDocument();
      expect(global.fetch).toHaveBeenCalledWith(
        `${API}/accounts/b2`,
        expect.objectContaining({ method: 'DELETE', credentials: 'include' }),
      );

      const row = screen.getByRole('row', { name: /Bruno Takeda/ });
      expect(within(row).getByText('Inativa')).toBeInTheDocument();
    });

    it.each([
      ['ACCOUNT_IS_PTS_RESPONSIBLE', 'A conta é responsável por um PTS ativo.'],
      ['ACCOUNT_ALREADY_DEACTIVATED', 'A conta já está desativada.'],
    ])('erro 409 %s mostra a mensagem da API', async (code, message) => {
      const user = userEvent.setup();
      mockApi({ remove: res({ status: code, message }, 409) });

      render(<AccountsPage />);

      const dialog = await openDeactivate(user);
      await user.click(dialog.getByRole('button', { name: 'Desativar conta' }));

      expect(await dialog.findByRole('alert')).toHaveTextContent(message);

      const row = screen.getByRole('row', { name: /Bruno Takeda/ });
      expect(within(row).getByText('Ativa')).toBeInTheDocument();
    });

    it('desativa também pelo modal Dados da conta', async () => {
      const user = userEvent.setup();
      mockApi();

      render(<AccountsPage />);

      await user.click(
        await (
          await openMenu(user, 'Bruno Takeda')
        ).findByRole('menuitem', {
          name: 'Visualizar',
        }),
      );
      const view = within(
        await screen.findByRole('dialog', { name: 'Bruno Takeda' }),
      );
      await user.click(await view.findByRole('button', { name: 'Desativar' }));

      const confirm = within(
        await screen.findByRole('dialog', {
          name: 'Desativar a conta de Bruno Takeda?',
        }),
      );
      await user.click(
        confirm.getByRole('button', { name: 'Desativar conta' }),
      );

      expect(
        await screen.findByText('Conta de Bruno Takeda desativada'),
      ).toBeInTheDocument();
    });
  });
});
