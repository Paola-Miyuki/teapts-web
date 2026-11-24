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
  (global.fetch as jest.Mock).mockImplementation((url: string) =>
    url.endsWith('/me')
      ? Promise.resolve(mockResponse({ data: account }))
      : professionals(url),
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
      await screen.findByText('Não foi possível consultar os profissionais.'),
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
      await screen.findByText('Profissional adicionado.'),
    ).toBeInTheDocument();
  });

  it('não mostra o aviso sem o parâmetro', async () => {
    mockApi(jest.fn().mockResolvedValue(mockResponse({ data: EMPTY })), ADMIN);

    render(<ProfessionalsPage />);

    await screen.findByText('Nenhum profissional cadastrado');
    expect(
      screen.queryByText('Profissional adicionado.'),
    ).not.toBeInTheDocument();
  });
});
