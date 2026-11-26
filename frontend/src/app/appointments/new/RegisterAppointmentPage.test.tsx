import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import type { Account } from '@/lib/account';
import { personalData } from '@/test-utils/account';

import RegisterAppointmentPage from './RegisterAppointmentPage';

const mockReplace = jest.fn();
const mockPush = jest.fn();
// Mesmo objeto em todo render, como o useRouter do Next.
const mockRouter = { replace: mockReplace, push: mockPush };

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

const API = 'http://localhost:3000';
const POST_URL = `${API}/activities/act-1/appointments`;

const professional: Account = {
  accountId: 'acc-1',
  name: 'Ana Souza',
  email: 'ana@example.com',
  role: 'user',
  ...personalData,
  patientProfileId: null,
  professionalProfileIds: ['prof-1'],
};
const admin: Account = {
  ...professional,
  name: 'Kaio',
  role: 'admin',
  professionalProfileIds: [],
};

const member = (id: string, name: string, specialism: string) => ({
  id,
  name,
  specialism: { id: specialism, name: specialism },
  registration: null,
});

const PTS = {
  id: 'pts-1',
  status: 'running',
  version: 2,
  patient: { id: 'patient-1', name: 'Ana Clara Ribeiro' },
  responsible: member('prof-1', 'Ana Souza', 'Psicólogo'),
  team: [member('prof-2', 'João Lima', 'Fonoaudiólogo')],
};

const ACTIVITIES = [
  {
    id: 'act-1',
    title: 'Integração sensorial',
    specialism: 'occupational_therapist',
    frequency: { quantity: 1, period: 'weekly', durationMinutes: 45 },
    modality: 'external_visit',
    visitPlace: 'school',
    executor: 'school',
    goalId: 'goal-1',
    status: 'running',
  },
  {
    id: 'act-2',
    title: 'Terapia de fala',
    specialism: 'speech_therapist',
    frequency: { quantity: 2, period: 'weekly', durationMinutes: 30 },
    modality: 'in_person',
    visitPlace: null,
    executor: 'team',
    goalId: null,
    status: 'running',
  },
];

const PATIENTS = [
  {
    id: 'patient-1',
    name: 'Ana Clara Ribeiro',
    activePtsId: 'pts-1',
    readOnly: false,
  },
  { id: 'patient-2', name: 'Só leitura', activePtsId: 'pts-2', readOnly: true },
];

function respond(status: number, body: unknown) {
  return {
    ok: status < 400,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

let fetchMock: jest.Mock;

function mockApi({
  pts = respond(200, PTS),
  activities = ACTIVITIES,
  post = respond(201, { id: 'app-1' }) as Response | Promise<Response>,
}: {
  pts?: Response;
  activities?: unknown[];
  post?: Response | Promise<Response>;
} = {}) {
  fetchMock = jest.fn((url: string, init?: RequestInit) => {
    const { pathname } = new URL(url);
    if (init?.method === 'POST') return Promise.resolve(post);
    if (pathname === '/patients/authorized')
      return Promise.resolve(
        respond(200, { data: PATIENTS, pagination: { total: 2 } }),
      );
    if (pathname.endsWith('/activities'))
      return Promise.resolve(
        respond(200, {
          data: activities,
          pagination: { page: 1, limit: 50, total: 2, totalPages: 1 },
        }),
      );
    if (pathname.endsWith('/goals'))
      return Promise.resolve(
        respond(200, { data: [{ id: 'goal-1', title: 'Reduzir as crises' }] }),
      );

    return Promise.resolve(pts);
  });
  global.fetch = fetchMock as unknown as typeof fetch;
}

const sentBody = () =>
  JSON.parse(fetchMock.mock.calls.find(([url]) => url === POST_URL)![1].body);
const fill = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const save = () =>
  fireEvent.click(
    screen.getByRole('button', { name: 'Registrar atendimento' }),
  );
const confirm = () =>
  fireEvent.click(
    within(
      screen.getByRole('dialog', { name: 'Registrar o atendimento?' }),
    ).getByRole('button', { name: 'Registrar atendimento' }),
  );

async function open(
  account = professional,
  activityId: string | null = 'act-1',
) {
  render(
    <RegisterAppointmentPage
      account={account}
      ptsId="pts-1"
      activityId={activityId ?? undefined}
    />,
  );
  await screen.findByRole('option', { name: 'Integração sensorial' });
}

function fillDone() {
  fill(/^Data do atendimento/, '2026-11-03');
  fill(/^Hora de início/, '14:00');
  fill(/^Hora de término/, '14:45');
  fill(/^S, Subjetivo/, '  Chegou tranquilo. ');
  fill(/^O, Objetivo/, 'Manteve o circuito.');
  fill(/^A, Avaliação/, 'Avanço.');
  fill(/^P, Plano/, 'Repetir.');
}

describe('Registrar atendimento (RFACT004)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi();
  });

  it('abre com o paciente e a atividade que vieram do PTS', async () => {
    await open();

    expect(screen.getByRole('combobox', { name: /^Paciente/ })).toHaveValue(
      'Ana Clara Ribeiro',
    );
    expect(screen.getByLabelText(/^Atividade/)).toHaveValue('act-1');
    const summary = within(screen.getByLabelText('Dados da atividade'));
    expect(summary.getByText('Terapeuta ocupacional')).toBeInTheDocument();
    expect(summary.getByText('1x por semana, 45 min')).toBeInTheDocument();
    expect(summary.getByText('Visita externa (Escola)')).toBeInTheDocument();
    expect(summary.getByText('Reduzir as crises')).toBeInTheDocument();
    // A modalidade parte da modalidade da atividade.
    expect(screen.getByLabelText(/^Modalidade/)).toHaveValue('external_visit');
    expect(screen.getByLabelText(/^Local da visita/)).toHaveValue('school');
    expect(screen.getByLabelText(/^Autor/)).toHaveValue('Ana Souza, Psicólogo');
    expect(screen.getByLabelText(/^Registrado por/)).toHaveValue(
      'Ana Souza (você)',
    );
    const activitiesUrl = fetchMock.mock.calls
      .map(([url]) => new URL(url))
      .find(({ pathname }) => pathname.endsWith('/activities'))!;
    expect(activitiesUrl.searchParams.getAll('status')).toEqual(['running']);
  });

  it('sem vir do PTS, escolhe o paciente com PTS ativo', async () => {
    render(<RegisterAppointmentPage account={professional} />);
    const input = screen.getByRole('combobox', { name: /^Paciente/ });
    fireEvent.focus(input);

    const option = await screen.findByRole('option', {
      name: 'Ana Clara Ribeiro',
    });
    expect(
      screen.queryByRole('option', { name: 'Só leitura' }),
    ).not.toBeInTheDocument();
    fireEvent.mouseDown(option);

    expect(
      await screen.findByRole('option', { name: 'Terapia de fala' }),
    ).toBeInTheDocument();
    expect(input).toHaveValue('Ana Clara Ribeiro');
  });

  it('registra o realizado depois da confirmação e volta ao PTS', async () => {
    let finish: (value: Response) => void = () => undefined;
    mockApi({
      post: new Promise<Response>((resolve) => {
        finish = resolve;
      }),
    });
    await open();
    fillDone();
    save();

    expect(
      screen.getByText(
        'Depois de salvo, o registro não é editado: correções viram retificação.',
      ),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(POST_URL, expect.anything());
    confirm();

    expect(
      screen.getByRole('button', { name: 'Registrando...' }),
    ).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledWith(
      POST_URL,
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    expect(sentBody()).toEqual({
      appointmentDate: '2026-11-03',
      startTime: '14:00',
      endTime: '14:45',
      modality: 'external_visit',
      visitPlace: 'school',
      attendance: 'done',
      soapSubjective: 'Chegou tranquilo.',
      soapObjective: 'Manteve o circuito.',
      soapAssessment: 'Avanço.',
      soapPlan: 'Repetir.',
    });

    finish(respond(201, { id: 'app-1' }));
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        '/pts/pts-1?appointment=registered#atividades',
      ),
    );
  });

  it.each([
    [/^Hora de início/, 'Informe a hora de início'],
    [/^Hora de término/, 'Informe a hora de término'],
    [/^Data do atendimento/, 'Informe a data do atendimento'],
    [/^Local da visita/, 'Informe o local da visita'],
    [/^S, Subjetivo/, 'Preencha o subjetivo'],
    [/^O, Objetivo/, 'Preencha o objetivo'],
    [/^A, Avaliação/, 'Preencha a avaliação'],
    [/^P, Plano/, 'Preencha o plano'],
  ])('no realizado, exige %s', async (label, message) => {
    await open();
    fillDone();
    fill(label, label.source.includes('Plano') ? '   ' : '');
    save();

    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('no realizado, o término é depois do início', async () => {
    await open();
    fillDone();
    fill(/^Hora de término/, '14:00');
    save();

    expect(
      screen.getByText('A hora de término precisa ser depois da de início'),
    ).toBeInTheDocument();
  });

  it('só a desmarcação pode ter data futura', async () => {
    const message = 'A data não pode ser futura';
    await open();
    fillDone();
    fill(/^Data do atendimento/, '2999-01-01');
    save();
    expect(screen.getByText(message)).toBeInTheDocument();

    fill(/^Comparecimento/, 'missed');
    save();
    expect(screen.getByText(message)).toBeInTheDocument();

    fill(/^Comparecimento/, 'cancelled');
    save();
    expect(screen.queryByText(message)).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('exige o paciente e a atividade', async () => {
    render(<RegisterAppointmentPage account={professional} />);
    save();

    expect(screen.getByText('Escolha o paciente')).toBeInTheDocument();
    expect(screen.getByText('Escolha a atividade')).toBeInTheDocument();
  });

  it.each([
    ['missed', 'Falta'],
    ['cancelled', 'Desmarcado'],
  ])('em %s não há SOAP, só o motivo opcional', async (attendance) => {
    await open();
    fillDone();
    fill(/^Comparecimento/, attendance);

    expect(screen.queryByLabelText(/^P, Plano/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Hora de término/)).not.toBeInTheDocument();
    fill(/^Motivo da falta/, ' Doente ');
    fill(/^Modalidade/, 'in_person');
    save();
    confirm();

    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    expect(sentBody()).toEqual({
      appointmentDate: '2026-11-03',
      startTime: '14:00',
      modality: 'in_person',
      attendance,
      absenceReason: 'Doente',
    });
  });

  it('o admin escolhe o autor ou deixa sem atribuir', async () => {
    await open(admin);
    expect(screen.getByLabelText(/^Autor/)).toHaveDisplayValue(
      'Sem atribuir (fica com a sua conta)',
    );
    fill(/^Autor/, 'prof-2');
    fill(/^Comparecimento/, 'missed');
    fill(/^Hora de início/, '14:00');
    save();
    confirm();

    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    expect(sentBody()).toMatchObject({ authorProfessionalId: 'prof-2' });
  });

  it('mostra a mensagem da API no diálogo', async () => {
    const message = 'Só uma atividade em andamento recebe atendimento.';
    mockApi({
      post: respond(409, { status: 'ACTIVITY_NOT_RUNNING', message }),
    });
    await open();
    fillDone();
    save();
    confirm();

    expect(
      await within(screen.getByRole('dialog')).findByText(message),
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('sem sessão, vai para o login', async () => {
    mockApi({ pts: respond(401, {}) });
    render(<RegisterAppointmentPage account={professional} ptsId="pts-1" />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
  });

  it('avisa quando não há atividade em andamento', async () => {
    mockApi({ activities: [] });
    render(<RegisterAppointmentPage account={professional} ptsId="pts-1" />);

    expect(
      await screen.findByText('Este PTS não tem atividade em andamento.'),
    ).toBeInTheDocument();
  });

  it.each([
    ['fora da equipe', { ...professional, professionalProfileIds: ['x'] }, PTS],
    ['com o PTS encerrado', professional, { ...PTS, status: 'concluded' }],
  ])('não deixa registrar %s', async (_name, account, pts) => {
    mockApi({ pts: respond(200, pts) });
    render(<RegisterAppointmentPage account={account} ptsId="pts-1" />);

    expect(
      await screen.findByText(
        'Só a equipe de um PTS ativo e o administrador registram atendimentos.',
      ),
    ).toBeInTheDocument();
  });

  it('mostra o erro do carregamento e tenta de novo', async () => {
    mockApi({ pts: respond(500, {}) });
    render(<RegisterAppointmentPage account={professional} ptsId="pts-1" />);
    expect(
      await screen.findByText('Não foi possível carregar o PTS.'),
    ).toBeInTheDocument();

    mockApi();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(
      await screen.findByRole('option', { name: 'Integração sensorial' }),
    ).toBeInTheDocument();
  });
});
