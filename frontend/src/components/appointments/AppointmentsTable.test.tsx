import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';

import type { PermissionUser } from '@/lib/permissions';

import AppointmentsTable from './AppointmentsTable';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const API = 'http://localhost:3000';

const author: PermissionUser = {
  accountId: 'acc-2',
  role: 'user',
  patientProfileId: null,
  professionalProfileIds: ['prof-2'],
};
const responsible: PermissionUser = {
  ...author,
  accountId: 'acc-1',
  professionalProfileIds: ['prof-1'],
};
const admin: PermissionUser = {
  accountId: 'acc-admin',
  role: 'admin',
  patientProfileId: null,
  professionalProfileIds: [],
};
const patient: PermissionUser = {
  accountId: 'patient-1',
  role: 'user',
  patientProfileId: 'patient-1',
  professionalProfileIds: [],
};

const ITEM = {
  id: 'app-1',
  appointmentDate: '2026-11-03',
  startTime: '14:00',
  endTime: '14:45',
  patient: { id: 'patient-1', name: 'Luna Prado' },
  pts: { id: 'pts-1', version: 1 },
  activity: {
    id: 'act-1',
    title: 'Integração sensorial',
    specialism: 'occupational_therapist',
  },
  author: {
    id: 'prof-2',
    name: 'João Lima',
    specialism: 'occupational_therapist',
  },
  registeredBy: { id: 'acc-2', name: 'João Lima' },
  modality: 'in_person',
  visitPlace: null,
  attendance: 'done',
  rectified: true,
};
// Registrado pelo admin sem atribuir profissional (RN029).
const BY_ADMIN = {
  ...ITEM,
  author: null,
  registeredBy: { id: 'acc-admin', name: 'Kaio' },
};
const MISSED = {
  ...ITEM,
  id: 'app-2',
  appointmentDate: '2026-11-01',
  endTime: null,
  activity: { ...ITEM.activity, title: 'Fonoterapia' },
  attendance: 'missed',
  rectified: false,
};

const SOAP = {
  subjective: 'Chegou tranquilo.',
  objective: 'Manteve o circuito por 15 minutos.',
  assessment: 'Avanço na tolerância tátil.',
  plan: 'Repetir o circuito.',
};

const RECORD = {
  id: 'app-1',
  appointmentDate: '2026-11-03',
  startTime: '14:00',
  endTime: '14:45',
  modality: 'in_person',
  visitPlace: null,
  attendance: 'done',
  author: ITEM.author,
  registeredBy: { id: 'acc-2', name: 'João Lima' },
  createdAt: '2026-11-03T17:50:00.000Z',
  absenceReason: null,
};

const TEAM_DETAILS = {
  ...RECORD,
  soap: SOAP,
  rectificationReason: null,
  patient: ITEM.patient,
  pts: ITEM.pts,
  activity: ITEM.activity,
  rectifiesAppointmentId: null,
  rectified: true,
  rectifications: [
    {
      ...RECORD,
      id: 'app-3',
      endTime: '14:50',
      soap: SOAP,
      rectificationReason: 'Horário de término registrado errado.',
      createdAt: '2026-11-04T12:00:00.000Z',
    },
  ],
};

const PATIENT_DETAILS = {
  ...RECORD,
  plan: SOAP.plan,
  patient: ITEM.patient,
  pts: ITEM.pts,
  activity: ITEM.activity,
  rectifiesAppointmentId: null,
  rectified: false,
  rectifications: [],
};

function list(data: unknown[], total = data.length) {
  return {
    data,
    pagination: {
      page: 1,
      limit: 10,
      total,
      totalPages: Math.max(1, Math.ceil(total / 10)),
    },
  };
}

function respond(status: number, data: unknown) {
  return {
    ok: status < 400,
    status,
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response;
}

type Route = (url: string, init?: RequestInit) => Response | undefined;

function mockApi(...routes: Route[]) {
  global.fetch = jest.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      for (const route of routes) {
        const response = route(url, init);

        if (response) {
          return response;
        }
      }

      throw new Error(`Rota não mockada: ${url}`);
    },
  ) as jest.Mock;
}

const listRoute =
  (data: unknown[], total?: number): Route =>
  (url) =>
    url.startsWith(`${API}/appointments?`)
      ? respond(200, list(data, total))
      : undefined;

const detailsRoute =
  (details: unknown): Route =>
  (url, init) =>
    url === `${API}/appointments/app-1` && !init?.method
      ? respond(200, details)
      : undefined;

function calls() {
  return jest.mocked(global.fetch).mock.calls.map(([url, init]) => ({
    url: String(url),
    init,
  }));
}

async function openRowAction(name: string) {
  const user = userEvent.setup();

  await screen.findByText('Integração sensorial');
  await user.click(
    screen.getByRole('button', {
      name: 'Ações para Atendimento de 03/11/2026',
    }),
  );
  await user.click(screen.getByRole('menuitem', { name }));

  return user;
}

describe('AppointmentsTable (RFACT006)', () => {
  const replace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace });
  });

  it('carrega a página da equipe com o paciente, o autor e o selo de retificado', async () => {
    mockApi(listRoute([ITEM, MISSED]));

    render(
      <AppointmentsTable
        id="appointments"
        title="Atendimentos"
        account={author}
        showPatient
      />,
    );

    expect(await screen.findByText('Integração sensorial')).toBeInTheDocument();
    expect(calls()[0].url).toBe(`${API}/appointments?page=1&limit=10`);
    expect(calls()[0].init).toMatchObject({ credentials: 'include' });
    expect(screen.getByText('2 atendimentos')).toBeInTheDocument();

    const first = screen.getByRole('row', { name: /Integração sensorial/ });

    expect(within(first).getByText('03/11/2026')).toBeInTheDocument();
    expect(within(first).getByText('Retificado')).toBeInTheDocument();
    expect(
      within(first).getByRole('link', { name: 'Luna Prado' }),
    ).toHaveAttribute('href', '/patients/patient-1');
    expect(within(first).getByText('João Lima')).toBeInTheDocument();
    expect(
      within(first).getByText('Terapeuta ocupacional'),
    ).toBeInTheDocument();
    expect(within(first).getByText('Presencial')).toBeInTheDocument();
    expect(within(first).getByText('Realizado')).toBeInTheDocument();

    const second = screen.getByRole('row', { name: /Fonoterapia/ });

    expect(within(second).getByText('Falta')).toBeInTheDocument();
    expect(within(second).queryByText('Retificado')).not.toBeInTheDocument();
  });

  it('manda o filtro fixo da aba e os filtros escolhidos para a API', async () => {
    const user = userEvent.setup();
    mockApi(listRoute([ITEM]));

    render(
      <AppointmentsTable
        id="pts-appointments"
        title="Atendimentos"
        account={author}
        scope={{ ptsId: 'pts-1' }}
      />,
    );

    await screen.findByText('Integração sensorial');
    expect(calls()[0].url).toBe(
      `${API}/appointments?page=1&limit=10&ptsId=pts-1`,
    );
    expect(
      screen.queryByRole('columnheader', { name: 'Paciente' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Filtros' }));
    await user.click(screen.getByLabelText('Falta'));
    await user.click(screen.getByLabelText('Teleatendimento'));

    await waitFor(() =>
      expect(calls().at(-1)?.url).toBe(
        `${API}/appointments?page=1&limit=10&ptsId=pts-1&attendance=missed&modality=telehealth`,
      ),
    );

    await user.click(screen.getByRole('button', { name: 'Limpar' }));

    await waitFor(() =>
      expect(calls().at(-1)?.url).toBe(
        `${API}/appointments?page=1&limit=10&ptsId=pts-1`,
      ),
    );
  });

  it('filtra pelo profissional autor e inverte a ordem pela data', async () => {
    const user = userEvent.setup();
    mockApi(listRoute([ITEM]), (url) =>
      url.startsWith(`${API}/professionals?`)
        ? respond(200, list([{ id: 'prof-2', name: 'João Lima' }]))
        : undefined,
    );

    render(
      <AppointmentsTable
        id="appointments"
        title="Atendimentos"
        account={author}
      />,
    );

    await screen.findByText('Integração sensorial');
    await user.click(screen.getByRole('button', { name: 'Ordem decrescente' }));

    await waitFor(() =>
      expect(calls().at(-1)?.url).toBe(
        `${API}/appointments?page=1&limit=10&order=asc`,
      ),
    );
    expect(
      screen.getByRole('button', { name: 'Ordem crescente' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Filtros' }));
    await user.type(screen.getByLabelText('Profissional'), 'João');
    await waitFor(() =>
      expect(
        document.querySelector('option[value="João Lima"]'),
      ).not.toBeNull(),
    );
    await user.clear(screen.getByLabelText('Profissional'));
    await user.type(screen.getByLabelText('Profissional'), 'João Lima');

    await waitFor(() =>
      expect(calls().at(-1)?.url).toBe(
        `${API}/appointments?page=1&limit=10&authorId=prof-2&order=asc`,
      ),
    );
  });

  it('o paciente não tem o filtro de profissional', async () => {
    const user = userEvent.setup();
    mockApi(listRoute([ITEM]));

    render(
      <AppointmentsTable
        id="my-appointments"
        title="Meus atendimentos"
        account={patient}
        scope={{ patientId: 'patient-1' }}
      />,
    );

    await screen.findByText('Integração sensorial');
    await user.click(screen.getByRole('button', { name: 'Filtros' }));

    expect(screen.queryByLabelText('Profissional')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Período')).toBeInTheDocument();
  });

  it('sem autor, mostra quem registrou e só esse admin retifica (RN029)', async () => {
    mockApi(listRoute([BY_ADMIN]));

    render(
      <AppointmentsTable
        id="appointments"
        title="Atendimentos"
        account={admin}
      />,
    );

    const user = userEvent.setup();
    await screen.findByText('Integração sensorial');
    const row = screen.getByRole('row', { name: /Integração sensorial/ });

    expect(within(row).getByText('Kaio')).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', {
        name: 'Ações para Atendimento de 03/11/2026',
      }),
    );

    expect(
      screen.getByRole('menuitem', { name: 'Retificar' }),
    ).toBeInTheDocument();
  });

  it('mostra a lista vazia e o erro com a mensagem da API', async () => {
    const user = userEvent.setup();
    mockApi(listRoute([]));

    const { unmount } = render(
      <AppointmentsTable
        id="appointments"
        title="Atendimentos"
        account={author}
      />,
    );

    expect(
      await screen.findByText('Nenhum atendimento registrado'),
    ).toBeInTheDocument();
    unmount();

    mockApi(() =>
      respond(403, {
        status: 'FORBIDDEN',
        message: 'Você não tem acesso a estes atendimentos.',
      }),
    );
    render(
      <AppointmentsTable
        id="appointments"
        title="Atendimentos"
        account={author}
      />,
    );

    expect(
      await screen.findByText('Você não tem acesso a estes atendimentos.'),
    ).toBeInTheDocument();

    mockApi(listRoute([ITEM]));
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('Integração sensorial')).toBeInTheDocument();
  });

  it('a equipe vê o SOAP e o bloco da retificação no modal', async () => {
    mockApi(listRoute([ITEM]), detailsRoute(TEAM_DETAILS));

    render(
      <AppointmentsTable
        id="appointments"
        title="Atendimentos"
        account={responsible}
      />,
    );
    await openRowAction('Visualizar');

    const dialog = await screen.findByRole('dialog', {
      name: 'Atendimento de 03/11/2026',
    });

    expect(
      await within(dialog).findByText('Evolução (SOAP)'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Luna Prado')).toBeInTheDocument();
    expect(within(dialog).getAllByText('Chegou tranquilo.')).toHaveLength(2);
    expect(within(dialog).getByText('Retificação')).toBeInTheDocument();
    expect(
      within(dialog).getByText('Horário de término registrado errado.'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        'Retificado: o registro original continua guardado.',
      ),
    ).toBeInTheDocument();
    // O responsável não é o autor: não retifica.
    expect(
      within(dialog).queryByRole('button', { name: 'Retificar' }),
    ).not.toBeInTheDocument();
  });

  it('o paciente vê só o plano e a assinatura (RN028)', async () => {
    mockApi(listRoute([ITEM]), detailsRoute(PATIENT_DETAILS));

    render(
      <AppointmentsTable
        id="my-appointments"
        title="Meus atendimentos"
        account={patient}
        scope={{ patientId: 'patient-1' }}
      />,
    );
    await openRowAction('Visualizar');

    const dialog = await screen.findByRole('dialog');

    expect(
      await within(dialog).findByText('Plano e orientações'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Repetir o circuito.')).toBeInTheDocument();
    expect(
      within(dialog).queryByText('Evolução (SOAP)'),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).getByText(/Assinado por João Lima em/),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Especialidade: Todas as especialidades'),
    ).not.toBeInTheDocument();
  });

  it('esconde "Retificar" de quem não é o autor', async () => {
    mockApi(listRoute([ITEM]));

    render(
      <AppointmentsTable
        id="appointments"
        title="Atendimentos"
        account={responsible}
      />,
    );

    const user = userEvent.setup();
    await screen.findByText('Integração sensorial');
    await user.click(
      screen.getByRole('button', {
        name: 'Ações para Atendimento de 03/11/2026',
      }),
    );

    expect(
      screen.getByRole('menuitem', { name: 'Visualizar' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'Retificar' }),
    ).not.toBeInTheDocument();
  });
});

describe('Retificar atendimento (RFACT007)', () => {
  const replace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace });
  });

  const rectifyRoute =
    (status: number, body: unknown): Route =>
    (url, init) =>
      url === `${API}/appointments/app-1/rectify` && init?.method === 'POST'
        ? respond(status, body)
        : undefined;

  it('o autor retifica com os campos preenchidos e a justificativa', async () => {
    mockApi(
      rectifyRoute(201, {
        id: 'app-4',
        rectifiesAppointmentId: 'app-1',
        createdAt: '2026-11-05T12:00:00.000Z',
      }),
      detailsRoute(TEAM_DETAILS),
      listRoute([ITEM]),
    );

    render(
      <AppointmentsTable
        id="appointments"
        title="Atendimentos"
        account={author}
      />,
    );
    const user = await openRowAction('Retificar');

    const dialog = await screen.findByRole('dialog', {
      name: 'Retificar atendimento',
    });

    // Preenchido com a versão mais nova (a retificação de 14:50).
    expect(within(dialog).getByLabelText(/Hora de término/)).toHaveValue(
      '14:50',
    );
    expect(
      within(dialog).getByRole('textbox', { name: /S, Subjetivo/ }),
    ).toHaveValue('Chegou tranquilo.');

    await user.click(
      within(dialog).getByRole('button', { name: 'Registrar retificação' }),
    );

    expect(
      within(dialog).getByText('Informe a justificativa da retificação'),
    ).toBeInTheDocument();
    expect(calls().some(({ url }) => url.endsWith('/rectify'))).toBe(false);

    await user.type(
      within(dialog).getByLabelText(/Justificativa da retificação/),
      'Término errado.',
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'Registrar retificação' }),
    );

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        `${API}/appointments/app-1/rectify`,
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({
            reason: 'Término errado.',
            appointmentDate: '2026-11-03',
            startTime: '14:00',
            modality: 'in_person',
            attendance: 'done',
            endTime: '14:50',
            soapSubjective: SOAP.subjective,
            soapObjective: SOAP.objective,
            soapAssessment: SOAP.assessment,
            soapPlan: SOAP.plan,
          }),
        }),
      ),
    );
    expect(
      await screen.findAllByText('Retificação registrada'),
    ).not.toHaveLength(0);
  });

  it('mostra a mensagem da API quando a retificação é recusada', async () => {
    mockApi(
      rectifyRoute(403, {
        status: 'FORBIDDEN',
        message: 'Só o autor do atendimento pode retificá-lo.',
      }),
      detailsRoute(TEAM_DETAILS),
      listRoute([ITEM]),
    );

    render(
      <AppointmentsTable
        id="appointments"
        title="Atendimentos"
        account={author}
      />,
    );
    const user = await openRowAction('Retificar');
    const dialog = await screen.findByRole('dialog', {
      name: 'Retificar atendimento',
    });

    await user.type(
      within(dialog).getByLabelText(/Justificativa da retificação/),
      'Término errado.',
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'Registrar retificação' }),
    );

    expect(
      await within(dialog).findByText(
        'Só o autor do atendimento pode retificá-lo.',
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Registrar retificação' }),
    ).toBeEnabled();
  });
});
