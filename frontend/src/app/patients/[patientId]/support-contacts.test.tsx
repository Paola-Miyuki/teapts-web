import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useRouter } from 'next/navigation';

import type { Account } from '@/lib/account';
import { personalData } from '@/test-utils/account';

import PatientDetail from './PatientDetail';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const API = 'http://localhost:3000';
const PATIENT_ID = 'patient-1';
const CONTACTS_URL = `${API}/patients/${PATIENT_ID}/support-contacts`;

const ADMIN: Account = {
  accountId: 'admin-uuid',
  name: 'Admin',
  email: 'admin@example.com',
  role: 'admin',
  ...personalData,
  patientProfileId: null,
  professionalProfileIds: [],
};

const PROFESSIONAL: Account = {
  ...ADMIN,
  accountId: 'professional-uuid',
  name: 'Paula Profissional',
  role: 'user',
  professionalProfileIds: ['professional-profile'],
};

const JULIANA = {
  id: 'contact-1',
  name: 'Juliana Ribeiro',
  description: 'Mãe',
  email: 'juliana@example.com',
  phone: '(41) 99812-3344',
  isEmergency: true,
};

const ROSA = {
  id: 'contact-2',
  name: 'Rosa Ribeiro',
  description: 'Avó',
  email: null,
  phone: '(41) 99677-2211',
  isEmergency: false,
};

function patient(readOnly: boolean) {
  return {
    id: PATIENT_ID,
    name: 'Ana Clara Ribeiro',
    socialName: null,
    email: 'ribeiro.familia@gmail.com',
    cpf: '11144477735',
    cns: '700001234567891',
    guardianName: 'Juliana Ribeiro',
    registeredAt: '2026-02-14T12:00:00.000Z',
    ptsStatus: readOnly ? 'concluded' : 'running',
    activePtsId: readOnly ? null : 'pts-1',
    readOnly,
    supportContacts: [JULIANA, ROSA],
  };
}

function respond(status: number, data?: unknown) {
  return {
    ok: status < 400,
    status,
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response;
}

type Handler = (init: RequestInit) => Response;

function mockApi(
  account: Account,
  detail: ReturnType<typeof patient>,
  handlers: Record<string, Handler> = {},
) {
  global.fetch = jest.fn((url: string, init: RequestInit = {}) => {
    if (url.endsWith('/me')) {
      return Promise.resolve(respond(200, account));
    }

    const handler = handlers[`${init.method ?? 'GET'} ${url}`];

    if (handler) {
      return Promise.resolve(handler(init));
    }

    return Promise.resolve(respond(200, detail));
  }) as jest.Mock;
}

function bodyOf(call: [string, RequestInit]) {
  return JSON.parse(call[1].body as string);
}

describe('contatos de suporte em /patients/[patientId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace: jest.fn() });
  });

  it('o admin vê Adicionar, Editar e Remover e o selo de emergência', async () => {
    mockApi(ADMIN, patient(true));

    render(<PatientDetail id={PATIENT_ID} />);

    await screen.findByText('Juliana Ribeiro', { selector: 'strong' });
    expect(screen.getByText('Emergência')).toHaveClass('badge', 'rejected');
    expect(
      screen.getByRole('button', { name: 'Adicionar contato' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Editar Rosa Ribeiro' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Remover Rosa Ribeiro' }),
    ).toBeInTheDocument();
  });

  it('o profissional de PTS ativo edita; o de PTS encerrado só lê', async () => {
    mockApi(PROFESSIONAL, patient(false));
    const { unmount } = render(<PatientDetail id={PATIENT_ID} />);

    expect(
      await screen.findByRole('button', { name: 'Adicionar contato' }),
    ).toBeInTheDocument();
    unmount();

    mockApi(PROFESSIONAL, patient(true));
    render(<PatientDetail id={PATIENT_ID} />);

    await screen.findByText('Rosa Ribeiro', { selector: 'strong' });
    expect(
      screen.queryByRole('button', { name: 'Adicionar contato' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Editar / }),
    ).not.toBeInTheDocument();
  });

  it('adiciona um contato com POST e mostra na lista', async () => {
    const user = userEvent.setup();
    const created = {
      id: 'contact-3',
      name: 'Lia Martins',
      description: null,
      email: 'lia@example.com',
      phone: null,
      isEmergency: false,
    };
    mockApi(ADMIN, patient(false), {
      [`POST ${CONTACTS_URL}`]: () => respond(201, created),
    });

    render(<PatientDetail id={PATIENT_ID} />);
    await user.click(
      await screen.findByRole('button', { name: 'Adicionar contato' }),
    );

    const dialog = within(await screen.findByRole('dialog'));

    await user.type(dialog.getByLabelText(/Nome do contato/), 'Lia Martins');
    await user.type(dialog.getByLabelText('E-mail'), 'lia@example.com');
    await user.click(dialog.getByRole('button', { name: 'Adicionar contato' }));

    expect(
      await screen.findByText('Lia Martins', { selector: 'strong' }),
    ).toBeInTheDocument();

    const post = (global.fetch as jest.Mock).mock.calls.find(
      ([, init]) => init?.method === 'POST',
    );

    expect(post[0]).toBe(CONTACTS_URL);
    expect(post[1].credentials).toBe('include');
    expect(bodyOf(post)).toEqual({
      name: 'Lia Martins',
      email: 'lia@example.com',
      isEmergency: false,
    });
  });

  it('valida sem chamar a API: e-mail ou telefone e telefone na emergência', async () => {
    const user = userEvent.setup();
    mockApi(ADMIN, patient(false));

    render(<PatientDetail id={PATIENT_ID} />);
    await user.click(
      await screen.findByRole('button', { name: 'Adicionar contato' }),
    );

    const dialog = within(await screen.findByRole('dialog'));
    const save = dialog.getByRole('button', { name: 'Adicionar contato' });

    await user.click(save);
    expect(dialog.getByText('Informe o nome do contato.')).toBeInTheDocument();

    await user.type(dialog.getByLabelText(/Nome do contato/), 'Lia');
    await user.click(save);
    expect(
      dialog.getByText('Informe o e-mail ou o telefone do contato.'),
    ).toBeInTheDocument();

    await user.type(dialog.getByLabelText('E-mail'), 'lia@example.com');
    await user.click(dialog.getByLabelText('Contato de emergência'));
    await user.click(save);
    expect(
      dialog.getByText('Informe o telefone do contato de emergência.'),
    ).toBeInTheDocument();

    expect(
      (global.fetch as jest.Mock).mock.calls.some(
        ([, init]) => init?.method === 'POST',
      ),
    ).toBe(false);
  });

  it('edita um contato com PATCH e limpa o campo esvaziado com null', async () => {
    const user = userEvent.setup();
    const updated = { ...JULIANA, email: null, description: 'Mãe da Ana' };
    mockApi(ADMIN, patient(false), {
      [`PATCH ${CONTACTS_URL}/contact-1`]: () => respond(200, updated),
    });

    render(<PatientDetail id={PATIENT_ID} />);
    await user.click(
      await screen.findByRole('button', { name: 'Editar Juliana Ribeiro' }),
    );

    const dialog = within(await screen.findByRole('dialog'));

    expect(dialog.getByLabelText(/Nome do contato/)).toHaveValue(
      'Juliana Ribeiro',
    );
    await user.clear(dialog.getByLabelText('E-mail'));
    await user.clear(dialog.getByLabelText('Descrição'));
    await user.type(dialog.getByLabelText('Descrição'), 'Mãe da Ana');
    await user.click(dialog.getByRole('button', { name: 'Salvar contato' }));

    expect(await screen.findByText(/Mãe da Ana/)).toBeInTheDocument();

    const patch = (global.fetch as jest.Mock).mock.calls.find(
      ([, init]) => init?.method === 'PATCH',
    );

    expect(bodyOf(patch)).toEqual({
      name: 'Juliana Ribeiro',
      description: 'Mãe da Ana',
      email: null,
      phone: '(41) 99812-3344',
      isEmergency: true,
    });
  });

  it('mostra a mensagem da API no diálogo e mantém o contato', async () => {
    const user = userEvent.setup();
    mockApi(ADMIN, patient(false), {
      [`PATCH ${CONTACTS_URL}/contact-2`]: () =>
        respond(403, {
          status: 'FORBIDDEN',
          message:
            'Acesso restrito ao administrador ou à equipe de um PTS ativo.',
        }),
    });

    render(<PatientDetail id={PATIENT_ID} />);
    await user.click(
      await screen.findByRole('button', { name: 'Editar Rosa Ribeiro' }),
    );

    const dialog = within(await screen.findByRole('dialog'));

    await user.click(dialog.getByRole('button', { name: 'Salvar contato' }));

    expect(await dialog.findByRole('alert')).toHaveTextContent(
      'Acesso restrito ao administrador ou à equipe de um PTS ativo.',
    );
  });

  it('remove só o contato escolhido, depois de confirmar', async () => {
    const user = userEvent.setup();
    mockApi(ADMIN, patient(false), {
      [`DELETE ${CONTACTS_URL}/contact-2`]: () => respond(204),
    });

    render(<PatientDetail id={PATIENT_ID} />);
    await user.click(
      await screen.findByRole('button', { name: 'Remover Rosa Ribeiro' }),
    );

    const dialog = within(await screen.findByRole('dialog'));

    expect(
      dialog.getByRole('heading', {
        name: 'Remover Rosa Ribeiro dos contatos de suporte?',
      }),
    ).toBeInTheDocument();
    expect(
      dialog.getByText('Só este contato sai da lista. Os outros não mudam.'),
    ).toBeInTheDocument();

    await user.click(dialog.getByRole('button', { name: 'Remover contato' }));

    await waitFor(() =>
      expect(
        screen.queryByText('Rosa Ribeiro', { selector: 'strong' }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByText('Juliana Ribeiro', { selector: 'strong' }),
    ).toBeInTheDocument();
  });

  it('cancelar a remoção não chama a API', async () => {
    const user = userEvent.setup();
    mockApi(ADMIN, patient(false));

    render(<PatientDetail id={PATIENT_ID} />);
    await user.click(
      await screen.findByRole('button', { name: 'Remover Rosa Ribeiro' }),
    );
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Cancelar',
      }),
    );

    expect(
      (global.fetch as jest.Mock).mock.calls.some(
        ([, init]) => init?.method === 'DELETE',
      ),
    ).toBe(false);
    expect(
      screen.getByText('Rosa Ribeiro', { selector: 'strong' }),
    ).toBeInTheDocument();
  });
});
