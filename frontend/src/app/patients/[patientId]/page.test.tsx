import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useRouter } from 'next/navigation';

import type { Account } from '@/lib/account';

import PatientDetail from './PatientDetail';
import { personalData } from '@/test-utils/account';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const API = 'http://localhost:3000';

const PROFESSIONAL: Account = {
  accountId: 'professional-uuid',
  name: 'Paula Profissional',
  email: 'paula@example.com',
  role: 'user',
  ...personalData,
  patientProfileId: null,
  professionalProfileIds: ['professional-profile'],
};

const PATIENT = {
  id: 'patient-1',
  name: 'Ana Clara Ribeiro',
  socialName: null,
  email: 'ribeiro.familia@gmail.com',
  phone: '41998123344',
  cpf: '11144477735',
  cns: '700001234567891',
  guardianName: 'Juliana Ribeiro',
  registeredAt: '2026-02-14T12:00:00.000Z',
  ptsStatus: 'concluded',
  activePtsId: null,
  readOnly: true,
  supportContacts: [
    {
      id: 'contact-1',
      name: 'Rosa Ribeiro',
      description: 'Avó',
      email: null,
      phone: '41996772211',
      isEmergency: false,
    },
  ],
};

function respond(status: number, data: unknown) {
  return {
    ok: status < 400,
    status,
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response;
}

function mockApi(detail: Response) {
  global.fetch = jest.fn((url: string) =>
    Promise.resolve(url.endsWith('/me') ? respond(200, PROFESSIONAL) : detail),
  ) as jest.Mock;
}

const ADMIN: Account = {
  ...PROFESSIONAL,
  accountId: 'admin-uuid',
  name: 'Kaio Admin',
  email: 'kaio.admin@example.com',
  role: 'admin',
  professionalProfileIds: [],
};

// Admin: /me responde a conta de admin, o DELETE /accounts/:id a resposta
// pedida e o detalhe, o paciente.
function mockAdminApi(deleteResponse?: Response) {
  global.fetch = jest.fn((url: string, init?: RequestInit) => {
    if (url.endsWith('/me')) {
      return Promise.resolve(respond(200, ADMIN));
    }

    if (init?.method === 'DELETE') {
      return Promise.resolve(
        deleteResponse ??
          respond(200, {
            id: 'patient-1',
            status: 'inactive',
            deactivatedAt: '2026-11-24T12:00:00.000Z',
          }),
      );
    }

    return Promise.resolve(respond(200, PATIENT));
  }) as jest.Mock;
}

describe('PatientDetail', () => {
  const replace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace });
  });

  it('mostra os dados do paciente, só leitura para PTS encerrado', async () => {
    mockApi(respond(200, PATIENT));

    render(<PatientDetail id="patient-1" />);

    expect(
      await screen.findByRole('heading', { name: 'Ana Clara Ribeiro' }),
    ).toBeInTheDocument();
    expect(screen.getByText('111.444.777-35')).toBeInTheDocument();
    expect(screen.getByText('700 0012 3456 7891')).toBeInTheDocument();
    expect(screen.getAllByText('Juliana Ribeiro')).not.toHaveLength(0);
    expect(screen.getByText('Concluído')).toHaveClass('badge', 'concluded');
    expect(screen.getByText('Rosa Ribeiro')).toBeInTheDocument();
    expect(screen.getByText(/Somente leitura/)).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      `${API}/patients/patient-1`,
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('não mostra o link para o PTS no perfil, nem com PTS ativo', async () => {
    mockApi(
      respond(200, {
        ...PATIENT,
        ptsStatus: 'running',
        activePtsId: 'pts-1',
        readOnly: false,
      }),
    );

    render(<PatientDetail id="patient-1" />);

    await screen.findByRole('heading', { name: 'Ana Clara Ribeiro' });
    expect(
      screen.queryByRole('link', { name: 'Abrir PTS' }),
    ).not.toBeInTheDocument();
  });

  it('mostra E-mail, Telefone e Cadastrado em no cartão da conta', async () => {
    mockApi(respond(200, PATIENT));

    render(<PatientDetail id="patient-1" />);

    await screen.findByRole('heading', { name: 'Ana Clara Ribeiro' });
    const facts = document.querySelector('.ux-idfacts') as HTMLElement;

    expect(facts.querySelectorAll('.ux-idfact-ic')).toHaveLength(3);
    expect(within(facts).getByText('E-mail')).toBeInTheDocument();
    expect(
      within(facts).getByText('ribeiro.familia@gmail.com'),
    ).toBeInTheDocument();
    expect(within(facts).getByText('Telefone')).toBeInTheDocument();
    expect(within(facts).getByText('(41) 99812-3344')).toBeInTheDocument();
    expect(within(facts).getByText('Cadastrado em')).toBeInTheDocument();
    expect(within(facts).getByText('14/02/2026')).toBeInTheDocument();
  });

  it('mostra "—" no telefone quando a conta não tem', async () => {
    mockApi(respond(200, { ...PATIENT, phone: null }));

    render(<PatientDetail id="patient-1" />);

    await screen.findByRole('heading', { name: 'Ana Clara Ribeiro' });
    const facts = document.querySelector('.ux-idfacts') as HTMLElement;

    expect(within(facts).getByLabelText('Não informado')).toBeInTheDocument();
  });

  it('não mostra o link sem PTS ativo', async () => {
    mockApi(respond(200, PATIENT));

    render(<PatientDetail id="patient-1" />);

    await screen.findByRole('heading', { name: 'Ana Clara Ribeiro' });
    expect(
      screen.queryByRole('link', { name: 'Abrir PTS' }),
    ).not.toBeInTheDocument();
  });

  it('não mostra "Excluir paciente" para o profissional', async () => {
    mockApi(respond(200, PATIENT));

    render(<PatientDetail id="patient-1" />);

    await screen.findByRole('heading', { name: 'Ana Clara Ribeiro' });
    expect(
      screen.queryByRole('button', { name: 'Excluir paciente' }),
    ).not.toBeInTheDocument();
  });

  it('exclui o paciente pelo admin e volta para a lista', async () => {
    const user = userEvent.setup();
    mockAdminApi();

    render(<PatientDetail id="patient-1" />);

    await user.click(
      await screen.findByRole('button', { name: 'Excluir paciente' }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByRole('heading', {
        name: 'Excluir o paciente Ana Clara Ribeiro?',
      }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/O prontuário do paciente é mantido/),
    ).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole('button', { name: 'Excluir paciente' }),
    );

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        `${API}/accounts/patient-1`,
        expect.objectContaining({ method: 'DELETE', credentials: 'include' }),
      ),
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/patients'));
  });

  it('mostra a mensagem da API e fica na página quando a exclusão falha', async () => {
    const user = userEvent.setup();
    mockAdminApi(
      respond(409, {
        status: 'ACCOUNT_ALREADY_DEACTIVATED',
        message: 'A conta já está desativada.',
      }),
    );

    render(<PatientDetail id="patient-1" />);

    await user.click(
      await screen.findByRole('button', { name: 'Excluir paciente' }),
    );
    const dialog = await screen.findByRole('dialog');
    await user.click(
      within(dialog).getByRole('button', { name: 'Excluir paciente' }),
    );

    expect(
      await within(dialog).findByText('A conta já está desativada.'),
    ).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalledWith('/patients');
  });

  it('mostra "Sem acesso" no 403', async () => {
    mockApi(
      respond(403, {
        status: 'FORBIDDEN',
        message: 'Acesso restrito ao profissional.',
      }),
    );

    render(<PatientDetail id="patient-1" />);

    expect(
      await screen.findByText('Sem acesso a este paciente'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Voltar para pacientes' }),
    ).toHaveAttribute('href', '/patients');
  });

  it('redireciona para o login no 401', async () => {
    mockApi(respond(401, {}));

    render(<PatientDetail id="patient-1" />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });
});
