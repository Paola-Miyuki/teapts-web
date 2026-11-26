import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useRouter } from 'next/navigation';

import type { Account } from '@/lib/account';
import { patientProfileExtras } from '@/test-utils/patient';
import { personalData } from '@/test-utils/account';

import PatientDetail from './PatientDetail';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const API = 'http://localhost:3000';
const PATIENT_ID = 'patient-1';
const PATIENT_URL = `${API}/patients/${PATIENT_ID}`;
const CLINICAL_URL = `${PATIENT_URL}/clinical-data`;

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
  role: 'user',
  professionalProfileIds: ['professional-profile'],
};

function patient(overrides: Record<string, unknown> = {}) {
  return {
    ...patientProfileExtras,
    id: PATIENT_ID,
    name: 'Ana Clara Ribeiro',
    socialName: null,
    email: 'ribeiro.familia@gmail.com',
    phone: '41998123344',
    cpf: '11144477735',
    cns: '700001234567891',
    guardianName: 'Juliana Ribeiro',
    registeredAt: '2026-02-14T12:00:00.000Z',
    ptsStatus: 'running',
    activePtsId: 'pts-1',
    readOnly: false,
    supportContacts: [],
    ...overrides,
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

    return Promise.resolve(handler ? handler(init) : respond(200, detail));
  }) as jest.Mock;
}

function calls(method: string) {
  return (global.fetch as jest.Mock).mock.calls.filter(
    ([, init]) => init?.method === method,
  );
}

async function openEditor(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', { name: 'Editar paciente' }),
  );

  return within(
    await screen.findByRole('dialog', { name: 'Editar Ana Clara Ribeiro' }),
  );
}

describe('Editar paciente em /patients/[patientId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace: jest.fn() });
  });

  it('mostra o botão único "Editar paciente" no cartão, e nenhum Editar nos cartões', async () => {
    mockApi(ADMIN, patient());

    render(<PatientDetail id={PATIENT_ID} />);

    expect(
      await screen.findByRole('button', { name: 'Editar paciente' }),
    ).toHaveClass('btn-primary');
    expect(
      screen.getByRole('button', { name: 'Excluir paciente' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Editar' }),
    ).not.toBeInTheDocument();
  });

  it('esconde o botão do profissional de PTS encerrado', async () => {
    mockApi(PROFESSIONAL, patient({ readOnly: true }));

    render(<PatientDetail id={PATIENT_ID} />);

    await screen.findByText('Somente leitura', { exact: false });
    expect(
      screen.queryByRole('button', { name: 'Editar paciente' }),
    ).not.toBeInTheDocument();
  });

  it('abre o modal com os dados do paciente, em quatro seções', async () => {
    const user = userEvent.setup();
    mockApi(ADMIN, patient());

    render(<PatientDetail id={PATIENT_ID} />);
    const dialog = await openEditor(user);

    for (const name of [
      'Dados da conta',
      'Dados do paciente',
      'Histórico clínico',
      'Contatos de suporte',
    ]) {
      expect(dialog.getByRole('heading', { name })).toBeInTheDocument();
    }

    expect(dialog.getByLabelText(/Nome completo/)).toHaveValue(
      'Ana Clara Ribeiro',
    );
    expect(dialog.getByLabelText(/CPF/)).toHaveValue('111.444.777-35');
    expect(dialog.getByLabelText('Telefone')).toHaveValue('(41) 99812-3344');
    expect(dialog.getByLabelText(/CEP/)).toHaveValue('80045-140');
    expect(dialog.getByLabelText(/UF/)).toHaveValue('PR');
    expect(dialog.getByLabelText('Escolaridade')).toHaveValue(
      'elementary_ongoing',
    );
    expect(dialog.getByLabelText('Antecedentes clínicos')).toHaveValue(
      patientProfileExtras.clinicalHistory,
    );
    expect(
      dialog.getByRole('button', { name: 'Salvar alterações' }),
    ).toBeInTheDocument();
  });

  it('deixa os dados da conta desabilitados para o profissional', async () => {
    const user = userEvent.setup();
    mockApi(PROFESSIONAL, patient());

    render(<PatientDetail id={PATIENT_ID} />);
    const dialog = await openEditor(user);

    for (const label of [
      /Nome completo/,
      'Nome social',
      /Data de nascimento/,
      /Sexo/,
      /CPF/,
      'Telefone',
      /E-mail/,
    ]) {
      expect(dialog.getByLabelText(label)).toBeDisabled();
    }

    expect(dialog.getByLabelText('Unidade de referência')).toBeEnabled();
  });

  it('salva só o que mudou: conta e dados no PATCH do paciente, histórico no clinical-data', async () => {
    const user = userEvent.setup();
    const saved = patient({
      name: 'Ana Clara R. Ribeiro',
      referenceUnit: 'UBS Centro',
    });
    mockApi(ADMIN, patient(), {
      [`PATCH ${PATIENT_URL}`]: () => respond(200, saved),
      [`PATCH ${CLINICAL_URL}`]: () =>
        respond(200, { ...saved, habits: 'Dorme às 21h.' }),
    });

    render(<PatientDetail id={PATIENT_ID} />);
    const dialog = await openEditor(user);

    await user.clear(dialog.getByLabelText(/Nome completo/));
    await user.type(
      dialog.getByLabelText(/Nome completo/),
      'Ana Clara R. Ribeiro',
    );
    await user.clear(dialog.getByLabelText('Unidade de referência'));
    await user.type(
      dialog.getByLabelText('Unidade de referência'),
      'UBS Centro',
    );
    await user.clear(dialog.getByLabelText('Hábitos'));
    await user.type(dialog.getByLabelText('Hábitos'), 'Dorme às 21h.');
    await user.click(dialog.getByRole('button', { name: 'Salvar alterações' }));

    expect(
      await screen.findByText('Dados de Ana Clara R. Ribeiro salvos'),
    ).toBeInTheDocument();
    expect(JSON.parse(calls('PATCH')[0][1].body)).toEqual({
      name: 'Ana Clara R. Ribeiro',
      referenceUnit: 'UBS Centro',
    });
    expect(calls('PATCH')[0][1].credentials).toBe('include');
    expect(JSON.parse(calls('PATCH')[1][1].body)).toEqual({
      habits: 'Dorme às 21h.',
    });
    expect(
      screen.queryByRole('dialog', { name: /^Editar Ana Clara/ }),
    ).not.toBeInTheDocument();
  });

  it('não envia dados da conta quando quem edita é o profissional', async () => {
    const user = userEvent.setup();
    mockApi(PROFESSIONAL, patient(), {
      [`PATCH ${PATIENT_URL}`]: () => respond(200, patient()),
    });

    render(<PatientDetail id={PATIENT_ID} />);
    const dialog = await openEditor(user);

    await user.type(dialog.getByLabelText('Filiação 2'), ' (pai)');
    await user.click(dialog.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(calls('PATCH')).toHaveLength(1));
    expect(JSON.parse(calls('PATCH')[0][1].body)).toEqual({
      filiation2: 'Não declarado (pai)',
    });
  });

  it('não chama a API quando nada mudou', async () => {
    const user = userEvent.setup();
    mockApi(ADMIN, patient());

    render(<PatientDetail id={PATIENT_ID} />);
    const dialog = await openEditor(user);
    await user.click(dialog.getByRole('button', { name: 'Salvar alterações' }));

    expect(
      await screen.findByText('Dados de Ana Clara Ribeiro salvos'),
    ).toBeInTheDocument();
    expect(calls('PATCH')).toHaveLength(0);
  });

  it('valida sem chamar a API: CPF, obrigatórios e responsável de menor de 18 anos', async () => {
    const user = userEvent.setup();
    mockApi(ADMIN, patient());

    render(<PatientDetail id={PATIENT_ID} />);
    const dialog = await openEditor(user);

    await user.clear(dialog.getByLabelText(/CPF/));
    await user.type(dialog.getByLabelText(/CPF/), '11111111111');
    await user.clear(dialog.getByLabelText(/Logradouro/));
    await user.clear(dialog.getByRole('textbox', { name: /^Filiação 1/ }));
    await user.clear(
      dialog.getByRole('textbox', { name: /^Responsável tutelar/ }),
    );
    await user.click(dialog.getByRole('button', { name: 'Salvar alterações' }));

    expect(dialog.getByText('Informe um CPF válido')).toBeInTheDocument();
    expect(
      dialog.getByText('Obrigatório para menor de 18 anos'),
    ).toBeInTheDocument();
    expect(dialog.getAllByText('Campo obrigatório')).toHaveLength(2);
    expect(calls('PATCH')).toHaveLength(0);
  });

  it('marca "Nenhuma alergia conhecida" e limpa o campo de alergias', async () => {
    const user = userEvent.setup();
    mockApi(ADMIN, patient(), {
      [`PATCH ${CLINICAL_URL}`]: () =>
        respond(200, { ...patient(), allergies: null, noKnownAllergies: true }),
    });

    render(<PatientDetail id={PATIENT_ID} />);
    const dialog = await openEditor(user);

    await user.click(dialog.getByLabelText('Nenhuma alergia conhecida'));
    expect(dialog.getByLabelText('Alergias e restrições')).toBeDisabled();
    await user.click(dialog.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(calls('PATCH')).toHaveLength(1));
    expect(JSON.parse(calls('PATCH')[0][1].body)).toEqual({
      noKnownAllergies: true,
      allergies: '',
    });
  });

  it('mostra o erro do e-mail já cadastrado e mantém o modal aberto', async () => {
    const user = userEvent.setup();
    mockApi(ADMIN, patient(), {
      [`PATCH ${PATIENT_URL}`]: () =>
        respond(409, {
          status: 'EMAIL_ALREADY_EXISTS',
          message: 'Este e-mail já está cadastrado.',
        }),
    });

    render(<PatientDetail id={PATIENT_ID} />);
    const dialog = await openEditor(user);

    await user.clear(dialog.getByLabelText(/E-mail/));
    await user.type(dialog.getByLabelText(/E-mail/), 'outro@example.com');
    await user.click(dialog.getByRole('button', { name: 'Salvar alterações' }));

    expect(
      (await dialog.findAllByText('Este e-mail já está cadastrado.')).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole('dialog', { name: 'Editar Ana Clara Ribeiro' }),
    ).toBeInTheDocument();
  });

  it('cancelar fecha o modal sem chamar a API', async () => {
    const user = userEvent.setup();
    mockApi(ADMIN, patient());

    render(<PatientDetail id={PATIENT_ID} />);
    const dialog = await openEditor(user);

    await user.click(dialog.getByRole('button', { name: 'Cancelar' }));

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Editar Ana Clara Ribeiro' }),
      ).not.toBeInTheDocument(),
    );
    expect(calls('PATCH')).toHaveLength(0);
  });
});
