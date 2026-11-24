import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import NewProfessionalPage from './page';

const push = jest.fn();
const replace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
}));

const ACCOUNT_ID = '0b6f5a4e-2c1d-4e8f-9a7b-3c2d1e0f9a8b';

function response(data: unknown, status = 200) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response;
}

const ADMIN = {
  accountId: 'admin-uuid',
  name: 'Maria Santos',
  email: 'maria.admin@teapts.local',
  role: 'admin',
  patientProfileId: null,
  professionalProfileIds: [],
};

const PROFESSIONAL = {
  ...ADMIN,
  accountId: 'prof-account',
  role: 'user',
  professionalProfileIds: ['professional-uuid'],
};

const CANDIDATES = {
  data: [
    {
      id: ACCOUNT_ID,
      name: 'Bruno Takeda',
      email: 'bruno@teapts.local',
    },
  ],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

// /me, a busca de contas e o POST /professionals, cada um com a sua resposta.
function mockApi({
  account = ADMIN,
  post = () => Promise.resolve(response({ id: 'new' }, 201)),
}: {
  account?: object;
  post?: () => Promise<Response>;
} = {}) {
  (global.fetch as jest.Mock).mockImplementation(
    (url: string, init?: RequestInit) => {
      if (url.endsWith('/me')) {
        return Promise.resolve(response(account));
      }

      if (init?.method === 'POST') {
        return post();
      }

      return Promise.resolve(response(CANDIDATES));
    },
  );
}

const posts = () =>
  (global.fetch as jest.Mock).mock.calls.filter(
    ([, init]) => init?.method === 'POST',
  );

async function fillForm() {
  await userEvent.click(
    await screen.findByPlaceholderText('Busque por nome ou e-mail'),
  );
  await userEvent.click(
    await screen.findByRole('option', { name: /Bruno Takeda/ }),
  );
  await userEvent.selectOptions(
    screen.getByLabelText(/^Profissão/),
    'Fonoaudiólogo',
  );
  await userEvent.type(screen.getByLabelText(/^Nº de registro/), ' 6789 ');
  await userEvent.selectOptions(screen.getByLabelText(/^UF do registro/), 'PR');
}

const submit = () =>
  userEvent.click(
    screen.getByRole('button', { name: 'Adicionar profissional' }),
  );

describe('Adicionar profissional (RFPRO002)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('mostra "Acesso restrito ao administrador" a quem não é admin', async () => {
    mockApi({ account: PROFESSIONAL });

    render(<NewProfessionalPage />);

    expect(
      await screen.findByRole('heading', {
        name: 'Acesso restrito ao administrador',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Profissão/)).not.toBeInTheDocument();
  });

  it('mostra o formulário do layout, com * nos obrigatórios e os botões no rodapé', async () => {
    mockApi();

    render(<NewProfessionalPage />);

    expect(
      await screen.findByRole('heading', { name: 'Adicionar profissional' }),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Busque por nome ou e-mail'),
    ).toHaveAttribute('role', 'combobox');
    for (const label of [
      /^Conta/,
      /^Profissão/,
      /^Nº de registro/,
      /^UF do registro/,
    ]) {
      expect(screen.getByLabelText(label)).toHaveAttribute(
        'aria-required',
        'true',
      );
    }
    expect(screen.getByLabelText('CNES')).toHaveAttribute(
      'placeholder',
      '0000000',
    );
    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute(
      'href',
      '/professionals',
    );
  });

  it('preenche o conselho pela profissão, sem permitir editar', async () => {
    mockApi();

    render(<NewProfessionalPage />);

    const council = await screen.findByLabelText('Conselho regional');
    expect(council).toHaveValue('');
    expect(council).toHaveAttribute('readonly');

    await userEvent.selectOptions(
      screen.getByLabelText(/^Profissão/),
      'Fonoaudiólogo',
    );
    expect(council).toHaveValue('CRFa');

    await userEvent.selectOptions(
      screen.getByLabelText(/^Profissão/),
      'Enfermeiro',
    );
    expect(council).toHaveValue('Coren');
  });

  it('lista as 20 profissões da lista fixa', async () => {
    mockApi();

    render(<NewProfessionalPage />);

    const select = await screen.findByLabelText(/^Profissão/);

    expect(select.querySelectorAll('option')).toHaveLength(21);
  });

  it('não envia sem conta, profissão, nº e UF, e marca os campos', async () => {
    mockApi();

    render(<NewProfessionalPage />);

    await screen.findByLabelText(/^Profissão/);
    await submit();

    expect(screen.getByText('Escolha a conta.')).toBeInTheDocument();
    expect(screen.getByText('Escolha a profissão.')).toBeInTheDocument();
    expect(
      screen.getByText('Informe o número de registro.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Escolha a UF do registro.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Nº de registro/)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(
      screen.getByPlaceholderText('Busque por nome ou e-mail'),
    ).toHaveFocus();
    expect(posts()).toHaveLength(0);
  });

  it('exige 7 dígitos no CNES, quando informado', async () => {
    mockApi();

    render(<NewProfessionalPage />);

    await fillForm();
    await userEvent.type(screen.getByLabelText('CNES'), '12345');
    await submit();

    expect(screen.getByText('O CNES deve ter 7 dígitos.')).toBeInTheDocument();
    expect(screen.getByLabelText('CNES')).toHaveFocus();
    expect(posts()).toHaveLength(0);
  });

  it('cria o perfil, com a UF em minúsculas, e volta para a lista com o aviso', async () => {
    mockApi();

    render(<NewProfessionalPage />);

    await fillForm();
    await userEvent.type(
      screen.getByLabelText('Instituição ou serviço de vínculo'),
      'CAPSi Boa Vista',
    );
    await userEvent.type(screen.getByLabelText('CNES'), '1234567');
    await submit();

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/professionals?added=1');
    });

    expect(posts()).toHaveLength(1);
    expect(posts()[0][0]).toBe('http://localhost:3000/professionals');
    expect(posts()[0][1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
    });
    expect(JSON.parse(posts()[0][1].body)).toEqual({
      accountId: ACCOUNT_ID,
      specialism: 'speech_therapist',
      councilNumber: '6789',
      councilState: 'pr',
      institution: 'CAPSi Boa Vista',
      cnes: '1234567',
    });
  });

  it('não envia instituição nem CNES vazios', async () => {
    mockApi();

    render(<NewProfessionalPage />);

    await fillForm();
    await submit();

    await waitFor(() => expect(push).toHaveBeenCalled());

    expect(JSON.parse(posts()[0][1].body)).toEqual({
      accountId: ACCOUNT_ID,
      specialism: 'speech_therapist',
      councilNumber: '6789',
      councilState: 'pr',
    });
  });

  it('mostra o loading no botão e bloqueia o envio duplicado', async () => {
    mockApi({ post: () => new Promise(() => {}) });

    render(<NewProfessionalPage />);

    await fillForm();
    await submit();

    const saving = await screen.findByRole('button', {
      name: 'Adicionando...',
    });

    expect(saving).toBeDisabled();
    expect(saving).toHaveAttribute('aria-busy', 'true');

    fireEvent.submit(saving.closest('form')!);

    expect(posts()).toHaveLength(1);
  });

  it.each([
    [
      409,
      'PROFESSIONAL_PROFILE_ALREADY_EXISTS',
      'A conta já possui um perfil profissional.',
    ],
    [404, 'ACCOUNT_NOT_FOUND', 'Conta não encontrada.'],
    [403, 'FORBIDDEN', 'Acesso restrito ao administrador.'],
  ])(
    'mostra a mensagem da API no formulário (%i)',
    async (status, code, message) => {
      mockApi({
        post: () =>
          Promise.resolve(response({ status: code, message }, status)),
      });

      render(<NewProfessionalPage />);

      await fillForm();
      await submit();

      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(push).not.toHaveBeenCalled();
    },
  );

  it('mostra uma mensagem padrão quando a API não explica o erro', async () => {
    mockApi({ post: () => Promise.resolve(response({}, 500)) });

    render(<NewProfessionalPage />);

    await fillForm();
    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível adicionar o profissional.',
    );
  });

  it('redireciona para o login quando a sessão expira (401)', async () => {
    mockApi({
      post: () => Promise.resolve(response({ message: 'unauthorised' }, 401)),
    });

    render(<NewProfessionalPage />);

    await fillForm();
    await submit();

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/login');
    });
  });
});
