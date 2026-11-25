import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import { useRouter, useSearchParams } from 'next/navigation';

import ProfessionalsPage from './page';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

const mockedUseRouter = useRouter as jest.Mock;
const mockedUseSearchParams = useSearchParams as jest.Mock;

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

const ACCOUNT = {
  accountId: 'account-uuid',
  name: 'Priscila Martins',
  email: 'priscila@example.com',
  role: 'user',
  patientProfileId: null,
  professionalProfileIds: ['professional-profile-uuid'],
};

// /me responde com a conta; as demais chamadas vão para o mock de profissionais.
function mockApi(professionals: jest.Mock, account: object = ACCOUNT) {
  (global.fetch as jest.Mock).mockImplementation(
    (url: string, init?: RequestInit) =>
      url.endsWith('/me')
        ? Promise.resolve(mockResponse({ data: account }))
        : professionals(url, init),
  );
}

describe('ProfessionalsPage', () => {
  const replace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockedUseRouter.mockReturnValue({
      replace,
    });
    mockedUseSearchParams.mockReturnValue(new URLSearchParams());

    global.fetch = jest.fn();
  });

  it('exibe o estado de carregamento', async () => {
    mockApi(jest.fn(() => new Promise(() => {})));

    render(<ProfessionalsPage />);

    expect(
      await screen.findByText('Carregando profissionais...'),
    ).toBeInTheDocument();
  });

  it('exibe a estrutura padrão com a conta autenticada', async () => {
    mockApi(jest.fn(() => new Promise(() => {})));

    render(<ProfessionalsPage />);

    expect(await screen.findByText('Priscila Martins')).toBeInTheDocument();

    const menu = within(
      screen.getByRole('navigation', { name: 'Menu principal' }),
    );

    expect(menu.getByRole('link', { name: 'PTS' })).toHaveAttribute(
      'href',
      '/pts/proposals',
    );
    expect(menu.getByRole('link', { name: 'Profissionais' })).toHaveAttribute(
      'href',
      '/professionals',
    );

    expect(menu.getByRole('link', { name: 'Início' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('consulta e exibe os profissionais', async () => {
    mockApi(
      jest.fn().mockResolvedValue(
        mockResponse({
          data: {
            data: [
              {
                id: 'professional-uuid',
                name: 'Maria Silva',
                email: 'maria@example.com',
                specialism: {
                  id: 'psychologist',
                  name: 'Psicologia',
                },
                registration: null,
                institution: null,
                cnes: null,
              },
            ],
            pagination: {
              page: 1,
              limit: 10,
              total: 1,
              totalPages: 1,
            },
          },
        }),
      ),
    );

    render(<ProfessionalsPage />);

    expect(await screen.findByText('Maria Silva')).toBeInTheDocument();

    expect(screen.getByText('maria@example.com')).toBeInTheDocument();

    const professionalRow = screen.getByText('Maria Silva').closest('tr');

    expect(professionalRow).not.toBeNull();

    expect(
      within(professionalRow!).getByText('Psicologia'),
    ).toBeInTheDocument();

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/professionals?page=1&limit=10',
      { credentials: 'include', signal: expect.any(AbortSignal) },
    );
  });

  it('mostra registro, instituição e, para o admin, situação e Visualizar', async () => {
    mockApi(
      jest.fn(() =>
        Promise.resolve(
          mockResponse({
            data: {
              data: [
                {
                  id: 'professional-uuid',
                  name: 'Ana Souza',
                  email: 'ana@example.com',
                  specialism: { id: 'psychologist', name: 'Psicologia' },
                  registration: {
                    council: 'CRP',
                    number: '12345',
                    state: 'pr',
                  },
                  institution: 'IMA',
                  cnes: '2771112',
                  status: 'active',
                },
              ],
              pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
            },
          }),
        ),
      ),
      { ...ACCOUNT, role: 'admin', professionalProfileIds: [] },
    );

    render(<ProfessionalsPage />);

    const row = (await screen.findByText('Ana Souza')).closest('tr')!;

    expect(within(row).getByText('CRP-PR 12345')).toBeInTheDocument();
    expect(
      within(row).getByRole('button', { name: 'Copiar Registro CRP-PR 12345' }),
    ).toBeInTheDocument();
    expect(within(row).getByText('IMA')).toBeInTheDocument();
    expect(within(row).getByText('Ativo')).toBeInTheDocument();

    fireEvent.click(
      within(row).getByRole('button', { name: 'Ações para Ana Souza' }),
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Visualizar' }));

    const dialog = screen.getByRole('dialog', { name: 'Ana Souza' });
    expect(within(dialog).getByText('2771112')).toBeInTheDocument();
    expect(within(dialog).getByText('CRP')).toBeInTheDocument();
  });

  it('não mostra situação nem ações para quem não é admin', async () => {
    mockApi(
      jest.fn(() =>
        Promise.resolve(
          mockResponse({
            data: {
              data: [
                {
                  id: 'professional-uuid',
                  name: 'Ana Souza',
                  email: 'ana@example.com',
                  specialism: { id: 'psychologist', name: 'Psicologia' },
                  registration: null,
                  institution: null,
                  cnes: null,
                },
              ],
              pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
            },
          }),
        ),
      ),
    );

    render(<ProfessionalsPage />);

    await screen.findByText('Ana Souza');
    expect(
      screen.queryByRole('columnheader', { name: 'Situação' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Ações para Ana Souza' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Registro' }),
    ).toBeInTheDocument();
  });

  it('exibe estado vazio quando não existem profissionais', async () => {
    mockApi(
      jest.fn().mockResolvedValue(
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
      ),
    );

    render(<ProfessionalsPage />);

    expect(
      await screen.findByText('Nenhum profissional cadastrado'),
    ).toBeInTheDocument();
  });

  it('exibe erro quando a consulta falha', async () => {
    mockApi(
      jest.fn().mockResolvedValue(
        mockResponse({
          status: 500,
          ok: false,
        }),
      ),
    );

    render(<ProfessionalsPage />);

    expect(
      await screen.findByText('Não foi possível consultar os profissionais'),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    ).toBeInTheDocument();
  });

  it('redireciona para login quando a sessão não é válida', async () => {
    mockApi(
      jest.fn().mockResolvedValue(
        mockResponse({
          status: 401,
          ok: false,
        }),
      ),
    );

    render(<ProfessionalsPage />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/login');
    });
  });

  const EMPTY_PAGE = {
    data: [],
    pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
  };

  it('lê busca, filtros e ordenação da URL e consulta a API com eles', async () => {
    mockedUseSearchParams.mockReturnValue(
      new URLSearchParams(
        'q=Maria&specialism=psychologist,doctor&council=CRP&uf=PR&sort=specialism&order=desc',
      ),
    );
    mockApi(jest.fn().mockResolvedValue(mockResponse({ data: EMPTY_PAGE })));

    render(<ProfessionalsPage />);

    await screen.findByText('Nenhum profissional encontrado');

    expect(global.fetch).toHaveBeenLastCalledWith(
      'http://localhost:3000/professionals?page=1&limit=10&q=Maria&specialism=doctor%2Cpsychologist&council=CRP&councilState=pr&sort=specialism&order=desc',
      { credentials: 'include', signal: expect.any(AbortSignal) },
    );
    expect(screen.getByRole('searchbox')).toHaveValue('Maria');
    expect(screen.getByLabelText('Ordenar por')).toHaveValue('specialism');
    expect(
      screen.getByRole('button', { name: 'Ordem decrescente' }),
    ).toBeInTheDocument();
  });

  it('grava os filtros e a ordenação na URL', async () => {
    mockApi(jest.fn().mockResolvedValue(mockResponse({ data: EMPTY_PAGE })));

    render(<ProfessionalsPage />);

    await screen.findByText('Nenhum profissional cadastrado');

    expect(
      screen.queryByRole('button', { name: 'Limpar' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Psicólogo' }));
    expect(replace).toHaveBeenLastCalledWith(
      '/professionals?specialism=psychologist',
      { scroll: false },
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'CRP' }));
    expect(replace).toHaveBeenLastCalledWith('/professionals?council=CRP', {
      scroll: false,
    });

    fireEvent.change(screen.getByLabelText('UF do registro'), {
      target: { value: 'SC' },
    });
    expect(replace).toHaveBeenLastCalledWith('/professionals?uf=SC', {
      scroll: false,
    });

    fireEvent.change(screen.getByLabelText('Ordenar por'), {
      target: { value: 'specialism' },
    });
    expect(replace).toHaveBeenLastCalledWith('/professionals?sort=specialism', {
      scroll: false,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Ordem crescente' }));
    expect(replace).toHaveBeenLastCalledWith('/professionals?order=desc', {
      scroll: false,
    });
  });

  it('limpa os filtros pela URL e mantém a busca e a ordenação', async () => {
    mockedUseSearchParams.mockReturnValue(
      new URLSearchParams(
        'q=Ana&specialism=doctor&council=CRM&uf=PR&sort=specialism',
      ),
    );
    mockApi(jest.fn().mockResolvedValue(mockResponse({ data: EMPTY_PAGE })));

    render(<ProfessionalsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Limpar' }));

    expect(replace).toHaveBeenLastCalledWith(
      '/professionals?q=Ana&sort=specialism',
      { scroll: false },
    );
  });

  it('busca com Enter, grava q na URL e limpa com Esc', async () => {
    mockApi(jest.fn().mockResolvedValue(mockResponse({ data: EMPTY_PAGE })));

    render(<ProfessionalsPage />);

    await screen.findByText('Nenhum profissional cadastrado');

    const input = screen.getByPlaceholderText('Nome, e-mail ou nº de registro');

    fireEvent.change(input, { target: { value: 'M' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(replace).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: ' Maria ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(replace).toHaveBeenLastCalledWith('/professionals?q=Maria', {
      scroll: false,
    });
    await waitFor(() =>
      expect(global.fetch).toHaveBeenLastCalledWith(
        'http://localhost:3000/professionals?page=1&limit=10&q=Maria',
        { credentials: 'include', signal: expect.any(AbortSignal) },
      ),
    );

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(input).toHaveValue('');
    expect(replace).toHaveBeenLastCalledWith('/professionals', {
      scroll: false,
    });
    await waitFor(() =>
      expect(global.fetch).toHaveBeenLastCalledWith(
        'http://localhost:3000/professionals?page=1&limit=10',
        { credentials: 'include', signal: expect.any(AbortSignal) },
      ),
    );
  });

  it('mostra a mensagem da API quando ela vem no erro', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) =>
      Promise.resolve(
        url.endsWith('/me')
          ? mockResponse({ data: ACCOUNT })
          : mockResponse({
              status: 400,
              ok: false,
              data: { status: 'ERROR', message: 'Parâmetro inválido: council' },
            }),
      ),
    );

    render(<ProfessionalsPage />);

    expect(
      await screen.findByText('Parâmetro inválido: council'),
    ).toBeInTheDocument();
  });

  it('consulta a próxima página mantendo os filtros', async () => {
    mockApi(
      jest
        .fn()
        .mockResolvedValueOnce(
          mockResponse({
            data: {
              data: [
                {
                  id: '1',
                  name: 'Ana Silva',
                  email: 'ana@example.com',
                  specialism: {
                    id: 'doctor',
                    name: 'Medicina',
                  },
                  registration: null,
                  institution: null,
                  cnes: null,
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
                  id: '11',
                  name: 'João Santos',
                  email: 'joao@example.com',
                  specialism: {
                    id: 'doctor',
                    name: 'Medicina',
                  },
                  registration: null,
                  institution: null,
                  cnes: null,
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
        ),
    );

    render(<ProfessionalsPage />);

    expect(await screen.findByText('Ana Silva')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Próxima página',
      }),
    );

    expect(await screen.findByText('João Santos')).toBeInTheDocument();

    expect(global.fetch).toHaveBeenLastCalledWith(
      'http://localhost:3000/professionals?page=2&limit=10',
      { credentials: 'include', signal: expect.any(AbortSignal) },
    );
  });
});

describe('ProfessionalsPage: adicionar profissional', () => {
  const replace = jest.fn();
  const ADMIN = { ...ACCOUNT, role: 'admin', professionalProfileIds: [] };
  const EMPTY = {
    data: [],
    pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseRouter.mockReturnValue({ replace });
    mockedUseSearchParams.mockReturnValue(new URLSearchParams());
    global.fetch = jest.fn();
  });

  it('mostra o botão só para o admin', async () => {
    mockApi(jest.fn().mockResolvedValue(mockResponse({ data: EMPTY })), ADMIN);

    const { unmount } = render(<ProfessionalsPage />);

    expect(
      await screen.findByRole('link', { name: 'Adicionar profissional' }),
    ).toHaveAttribute('href', '/professionals/new');
    unmount();

    mockApi(jest.fn().mockResolvedValue(mockResponse({ data: EMPTY })));
    render(<ProfessionalsPage />);

    await screen.findByText('Nenhum profissional cadastrado');
    expect(
      screen.queryByRole('link', { name: 'Adicionar profissional' }),
    ).not.toBeInTheDocument();
  });

  it('mostra o aviso depois de adicionar', async () => {
    mockedUseSearchParams.mockReturnValue(new URLSearchParams('added=1'));
    mockApi(jest.fn().mockResolvedValue(mockResponse({ data: EMPTY })), ADMIN);

    render(<ProfessionalsPage />);

    expect(
      await screen.findByText('Profissional adicionado'),
    ).toBeInTheDocument();
  });

  it('não mostra o aviso sem o parâmetro', async () => {
    mockApi(jest.fn().mockResolvedValue(mockResponse({ data: EMPTY })), ADMIN);

    render(<ProfessionalsPage />);

    await screen.findByText('Nenhum profissional cadastrado');
    expect(
      screen.queryByText('Profissional adicionado'),
    ).not.toBeInTheDocument();
  });
});

describe('ProfessionalsPage: situação da conta', () => {
  const replace = jest.fn();
  const ADMIN = { ...ACCOUNT, role: 'admin', professionalProfileIds: [] };
  const person = (name: string, status: 'active' | 'inactive') => ({
    id: `${name}-uuid`,
    name,
    email: `${name.toLowerCase()}@example.com`,
    specialism: { id: 'psychologist', name: 'Psicólogo' },
    registration: null,
    institution: null,
    cnes: null,
    status,
  });
  const PAGE = {
    data: {
      data: [person('Ana', 'active'), person('Bruno', 'inactive')],
      pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseRouter.mockReturnValue({ replace });
    mockedUseSearchParams.mockReturnValue(new URLSearchParams());
    global.fetch = jest.fn();
  });

  it('mostra a situação de cada conta, ativa ou inativa, ao admin', async () => {
    mockApi(jest.fn().mockResolvedValue(mockResponse(PAGE)), ADMIN);

    render(<ProfessionalsPage />);

    const active = (await screen.findByText('Ana')).closest('tr')!;
    const inactive = screen.getByText('Bruno').closest('tr')!;

    expect(within(active).getByText('Ativo')).toHaveClass('active');
    expect(within(inactive).getByText('Inativo')).toHaveClass('inactive');
  });

  it('filtra por situação só para o admin, gravando na URL', async () => {
    mockApi(jest.fn().mockResolvedValue(mockResponse(PAGE)), ADMIN);

    render(<ProfessionalsPage />);

    await screen.findByText('Ana');
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Inativo' }));

    expect(replace).toHaveBeenLastCalledWith('/professionals?status=inactive', {
      scroll: false,
    });
  });

  it('não mostra o filtro de situação a quem não é admin', async () => {
    mockApi(jest.fn().mockResolvedValue(mockResponse(PAGE)));

    render(<ProfessionalsPage />);

    await screen.findByText('Ana');
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));

    expect(
      screen.queryByRole('checkbox', { name: 'Inativo' }),
    ).not.toBeInTheDocument();
  });

  it('envia a situação da URL à API só para o admin', async () => {
    mockedUseSearchParams.mockReturnValue(
      new URLSearchParams('status=active,inactive'),
    );
    mockApi(jest.fn().mockResolvedValue(mockResponse(PAGE)), ADMIN);

    const { unmount } = render(<ProfessionalsPage />);

    await screen.findByText('Ana');
    expect(global.fetch).toHaveBeenLastCalledWith(
      'http://localhost:3000/professionals?page=1&limit=10&status=active%2Cinactive',
      { credentials: 'include', signal: expect.any(AbortSignal) },
    );
    unmount();

    mockApi(jest.fn().mockResolvedValue(mockResponse(PAGE)));
    render(<ProfessionalsPage />);

    await screen.findByText('Ana');
    expect(global.fetch).toHaveBeenLastCalledWith(
      'http://localhost:3000/professionals?page=1&limit=10',
      { credentials: 'include', signal: expect.any(AbortSignal) },
    );
  });

  it('o botão Limpar aparece com a situação e a remove da URL', async () => {
    mockedUseSearchParams.mockReturnValue(
      new URLSearchParams('status=inactive'),
    );
    mockApi(jest.fn().mockResolvedValue(mockResponse(PAGE)), ADMIN);

    render(<ProfessionalsPage />);

    await screen.findByText('Ana');
    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));

    expect(replace).toHaveBeenLastCalledWith('/professionals', {
      scroll: false,
    });
  });
});

describe('ProfessionalsPage: editar especialidade', () => {
  const replace = jest.fn();
  const ADMIN = { ...ACCOUNT, role: 'admin', professionalProfileIds: [] };
  const PAGE = {
    data: {
      data: [
        {
          id: 'ana-uuid',
          name: 'Ana Souza',
          email: 'ana@example.com',
          specialism: { id: 'psychologist', name: 'Psicólogo' },
          registration: { council: 'CRP', number: '12345', state: 'pr' },
          institution: null,
          cnes: null,
          status: 'active',
        },
      ],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    },
  };

  function updated(specialism: object, registration: object) {
    return {
      id: 'ana-uuid',
      accountId: 'account-uuid',
      name: 'Ana Souza',
      email: 'ana@example.com',
      specialism,
      registration,
      institution: null,
      cnes: null,
      deactivatedAt: null,
    };
  }

  // GET /professionals responde com a lista; o PATCH, com `patch`.
  function mockList(patch?: jest.Mock) {
    mockApi(
      jest.fn((_url: string, init?: RequestInit) =>
        init?.method === 'PATCH'
          ? patch!(_url, init)
          : Promise.resolve(mockResponse(PAGE)),
      ),
      ADMIN,
    );
  }

  async function openEdit() {
    render(<ProfessionalsPage />);

    const row = (await screen.findByText('Ana Souza')).closest('tr')!;

    fireEvent.click(
      within(row).getByRole('button', { name: 'Ações para Ana Souza' }),
    );
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'Editar especialidade' }),
    );

    return screen.getByRole('dialog', {
      name: 'Editar especialidade de Ana Souza',
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseRouter.mockReturnValue({ replace });
    mockedUseSearchParams.mockReturnValue(new URLSearchParams());
    global.fetch = jest.fn();
  });

  it('abre o modal pelo Visualizar', async () => {
    mockList();
    render(<ProfessionalsPage />);

    const row = (await screen.findByText('Ana Souza')).closest('tr')!;

    fireEvent.click(
      within(row).getByRole('button', { name: 'Ações para Ana Souza' }),
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Visualizar' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Ana Souza' })).getByRole(
        'button',
        { name: 'Editar especialidade' },
      ),
    );

    expect(
      screen.getByRole('dialog', { name: 'Editar especialidade de Ana Souza' }),
    ).toBeInTheDocument();
  });

  it('não mostra a ação a quem não é admin', async () => {
    mockApi(jest.fn().mockResolvedValue(mockResponse(PAGE)));
    render(<ProfessionalsPage />);

    await screen.findByText('Ana Souza');

    expect(
      screen.queryByRole('button', { name: 'Ações para Ana Souza' }),
    ).not.toBeInTheDocument();
  });

  it('com o mesmo conselho mantém o registro e atualiza a linha sem recarregar', async () => {
    const patch = jest.fn().mockResolvedValue(
      mockResponse({
        data: updated(
          { id: 'neuropsychologist', name: 'Neuropsicólogo' },
          { council: 'CRP', number: '12345', state: 'pr' },
        ),
      }),
    );
    mockList(patch);

    const dialog = await openEdit();

    expect(within(dialog).getByLabelText('Registro no conselho')).toHaveValue(
      'CRP-PR 12345',
    );
    expect(
      within(dialog).queryByLabelText(/Nº do novo registro/),
    ).not.toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText(/Profissão/), {
      target: { value: 'neuropsychologist' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Salvar alterações' }),
    );

    expect(await screen.findByText('Especialidade atualizada.')).toBeVisible();

    const [url, init] = patch.mock.calls[0];

    expect(url).toBe('http://localhost:3000/professionals/ana-uuid');
    expect(init.credentials).toBe('include');
    expect(JSON.parse(init.body)).toEqual({ specialism: 'neuropsychologist' });

    const row = screen.getByText('Ana Souza').closest('tr')!;

    expect(within(row).getByText('Neuropsicólogo')).toBeInTheDocument();
    expect(within(row).getByText('CRP-PR 12345')).toBeInTheDocument();
    // A lista não foi pedida de novo.
    expect(
      (global.fetch as jest.Mock).mock.calls.filter(([url]) =>
        String(url).includes('/professionals?'),
      ),
    ).toHaveLength(1);
  });

  it('com outro conselho pede o número e a UF e só salva com eles', async () => {
    const patch = jest.fn().mockResolvedValue(
      mockResponse({
        data: updated(
          { id: 'nurse', name: 'Enfermeiro' },
          { council: 'Coren', number: '5678', state: 'sp' },
        ),
      }),
    );
    mockList(patch);

    const dialog = await openEdit();

    fireEvent.change(within(dialog).getByLabelText(/Profissão/), {
      target: { value: 'nurse' },
    });

    expect(within(dialog).getByLabelText('Conselho regional')).toHaveValue(
      'Coren',
    );
    expect(
      within(dialog).queryByLabelText('Registro no conselho'),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Salvar alterações' }),
    );

    expect(
      await within(dialog).findByText('Informe o número do novo registro'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText('Escolha a UF do registro'),
    ).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();

    fireEvent.change(
      within(dialog).getByLabelText(/Nº do novo registro/, {
        selector: 'input',
      }),
      {
        target: { value: '5678' },
      },
    );
    fireEvent.change(within(dialog).getByLabelText(/UF do registro/), {
      target: { value: 'SP' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Salvar alterações' }),
    );

    await screen.findByText('Especialidade atualizada.');

    expect(JSON.parse(patch.mock.calls[0][1].body)).toEqual({
      specialism: 'nurse',
      councilNumber: '5678',
      councilState: 'sp',
    });
    expect(
      within(screen.getByText('Ana Souza').closest('tr')!).getByText(
        'Coren-SP 5678',
      ),
    ).toBeInTheDocument();
  });

  it('não salva com a mesma especialidade', async () => {
    const patch = jest.fn();
    mockList(patch);

    const dialog = await openEdit();

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Salvar alterações' }),
    );

    expect(
      await within(dialog).findByText(
        'Escolha uma profissão diferente da atual',
      ),
    ).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();
  });

  it('desabilita o Salvar durante o envio', async () => {
    mockList(jest.fn(() => new Promise(() => {})));

    const dialog = await openEdit();

    fireEvent.change(within(dialog).getByLabelText(/Profissão/), {
      target: { value: 'neuropsychologist' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Salvar alterações' }),
    );

    const saving = await within(dialog).findByRole('button', {
      name: 'Salvando...',
    });

    expect(saving).toBeDisabled();
  });

  it('mostra a mensagem da API no modal e mantém o modal aberto', async () => {
    mockList(
      jest.fn().mockResolvedValue(
        mockResponse({
          status: 404,
          ok: false,
          data: {
            status: 'PROFESSIONAL_NOT_FOUND',
            message: 'Profissional não encontrado.',
          },
        }),
      ),
    );

    const dialog = await openEdit();

    fireEvent.change(within(dialog).getByLabelText(/Profissão/), {
      target: { value: 'neuropsychologist' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Salvar alterações' }),
    );

    expect(
      await within(dialog).findByText('Profissional não encontrado.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Especialidade atualizada.')).toBeNull();
  });

  it('redireciona para o login quando a sessão expira', async () => {
    mockList(
      jest.fn().mockResolvedValue(
        mockResponse({
          status: 401,
          ok: false,
          data: { status: 'UNAUTHORISED', message: 'Sessão inválida' },
        }),
      ),
    );

    const dialog = await openEdit();

    fireEvent.change(within(dialog).getByLabelText(/Profissão/), {
      target: { value: 'neuropsychologist' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Salvar alterações' }),
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });
});

describe('ProfessionalsPage: desativar profissional', () => {
  const replace = jest.fn();
  const ADMIN = { ...ACCOUNT, role: 'admin', professionalProfileIds: [] };
  const person = (name: string, status: 'active' | 'inactive') => ({
    id: `${name}-uuid`,
    accountId: `${name}-account`,
    name,
    email: `${name.toLowerCase()}@example.com`,
    specialism: { id: 'psychologist', name: 'Psicólogo' },
    registration: null,
    institution: null,
    cnes: null,
    status,
  });
  const PAGE = {
    data: {
      data: [person('Ana', 'active'), person('Bruno', 'inactive')],
      pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
    },
  };

  // GET /professionals responde com a lista; o DELETE, com `remove`.
  function mockList(remove?: jest.Mock) {
    mockApi(
      jest.fn((url: string, init?: RequestInit) =>
        init?.method === 'DELETE'
          ? remove!(url, init)
          : Promise.resolve(mockResponse(PAGE)),
      ),
      ADMIN,
    );
  }

  async function openDialog() {
    render(<ProfessionalsPage />);

    const row = (await screen.findByText('Ana')).closest('tr')!;

    fireEvent.click(
      within(row).getByRole('button', { name: 'Ações para Ana' }),
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Desativar' }));

    return screen.getByRole('dialog', { name: 'Desativar Ana?' });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseRouter.mockReturnValue({ replace });
    mockedUseSearchParams.mockReturnValue(new URLSearchParams());
    global.fetch = jest.fn();
  });

  it('mostra "Desativar" só para o admin e só para conta ativa', async () => {
    mockList();
    render(<ProfessionalsPage />);

    const inactive = (await screen.findByText('Bruno')).closest('tr')!;

    fireEvent.click(
      within(inactive).getByRole('button', { name: 'Ações para Bruno' }),
    );

    expect(
      screen.queryByRole('menuitem', { name: 'Desativar' }),
    ).not.toBeInTheDocument();
  });

  it('não mostra a ação a quem não é admin', async () => {
    mockApi(jest.fn().mockResolvedValue(mockResponse(PAGE)));
    render(<ProfessionalsPage />);

    await screen.findByText('Ana');

    expect(
      screen.queryByRole('button', { name: 'Ações para Ana' }),
    ).not.toBeInTheDocument();
  });

  it('abre a confirmação com o botão de confirmar em vermelho', async () => {
    mockList();
    const dialog = await openDialog();

    expect(within(dialog).getByText(/sai das equipes de PTS/)).toBeVisible();
    expect(
      within(dialog).getByRole('button', { name: 'Desativar profissional' }),
    ).toHaveClass('btn-danger');
  });

  it('desativa pelo modal Visualizar', async () => {
    mockList();
    render(<ProfessionalsPage />);

    const row = (await screen.findByText('Ana')).closest('tr')!;

    fireEvent.click(
      within(row).getByRole('button', { name: 'Ações para Ana' }),
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Visualizar' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Ana' })).getByRole('button', {
        name: 'Desativar',
      }),
    );

    expect(
      screen.getByRole('dialog', { name: 'Desativar Ana?' }),
    ).toBeInTheDocument();
  });

  it('chama DELETE /accounts/:accountId e passa a linha para "Inativo"', async () => {
    const remove = jest.fn().mockResolvedValue(
      mockResponse({
        data: {
          id: 'Ana-account',
          status: 'inactive',
          deactivatedAt: '2026-11-10T15:00:00.000Z',
        },
      }),
    );
    mockList(remove);
    const dialog = await openDialog();

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Desativar profissional' }),
    );

    expect(await screen.findByText('Profissional desativado.')).toBeVisible();

    const row = screen.getByText('Ana').closest('tr')!;

    expect(within(row).getByText('Inativo')).toHaveClass('inactive');
    expect(remove).toHaveBeenCalledWith(
      expect.stringContaining('/accounts/Ana-account'),
      expect.objectContaining({ method: 'DELETE', credentials: 'include' }),
    );

    fireEvent.click(
      within(row).getByRole('button', { name: 'Ações para Ana' }),
    );

    expect(
      screen.queryByRole('menuitem', { name: 'Desativar' }),
    ).not.toBeInTheDocument();
  });

  it('desabilita o botão e mostra o carregamento durante o envio', async () => {
    mockList(jest.fn(() => new Promise(() => {})));
    const dialog = await openDialog();

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Desativar profissional' }),
    );

    expect(
      await within(dialog).findByRole('button', { name: 'Desativando...' }),
    ).toBeDisabled();
  });

  it('mostra a mensagem do 409 no diálogo e troca o menu pela nota de bloqueio', async () => {
    const message =
      'A conta tem perfil responsável por um PTS ativo. Transfira a responsabilidade antes de desativar.';
    mockList(
      jest.fn().mockResolvedValue(
        mockResponse({
          status: 409,
          ok: false,
          data: { status: 'ACCOUNT_IS_PTS_RESPONSIBLE', message },
        }),
      ),
    );
    const dialog = await openDialog();

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Desativar profissional' }),
    );

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(message);
    expect(
      screen.getByRole('dialog', { name: 'Desativar Ana?' }),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    const row = screen.getByText('Ana').closest('tr')!;

    fireEvent.click(
      within(row).getByRole('button', { name: 'Ações para Ana' }),
    );

    expect(
      screen.getByText(/Desativar fica bloqueado: Ana é responsável/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'Desativar' }),
    ).not.toBeInTheDocument();
  });

  it('redireciona para o login quando a sessão expira', async () => {
    mockList(
      jest.fn().mockResolvedValue(mockResponse({ status: 401, ok: false })),
    );
    const dialog = await openDialog();

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Desativar profissional' }),
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });
});
