import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useRouter } from 'next/navigation';

import type { Activity } from '@/lib/activities';

import ActivitiesTab from './ActivitiesTab';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const activity = (overrides: Partial<Activity> = {}): Activity => ({
  id: 'act-1',
  title: 'Integração sensorial',
  description: 'Circuito sensorial.',
  type: 'individual_session',
  specialism: 'occupational_therapist',
  frequency: { quantity: 1, period: 'weekly', durationMinutes: 45 },
  modality: 'in_person',
  visitPlace: null,
  executor: 'team',
  executorProfessionalIds: [],
  goalId: null,
  documentIds: [],
  status: 'suggested',
  authorProfessionalId: 'prof-2',
  createdAt: '2026-12-01T13:00:00.000Z',
  updatedAt: null,
  ...overrides,
});

const TEAM = [
  { id: 'prof-1', name: 'Ana Souza', specialism: 'Psicólogo' },
  { id: 'prof-2', name: 'João Lima', specialism: 'Fonoaudiólogo' },
];
const GOALS = [{ id: 'goal-1', title: 'Ampliar a comunicação' }];
const API = 'http://localhost:3000/pts/pts-1/activities';

function respond(status: number, body: unknown) {
  return {
    ok: status < 400,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('ActivitiesTab (RFACT001, RFACT005)', () => {
  const replace = jest.fn();
  const reload = jest.fn();
  let fetchMock: jest.Mock;

  function renderTab(
    props: Partial<React.ComponentProps<typeof ActivitiesTab>> = {},
  ) {
    return render(
      <ActivitiesTab
        ptsId="pts-1"
        activities={[activity()]}
        error={null}
        reload={reload}
        canCreate
        canEdit={() => true}
        team={TEAM}
        goals={GOALS}
        isAdmin={false}
        {...props}
      />,
    );
  }

  const fill = (label: RegExp | string, value: string) =>
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  const submit = () =>
    fireEvent.click(screen.getByRole('button', { name: 'Sugerir atividade' }));
  const sentBody = () => JSON.parse(fetchMock.mock.calls[0][1].body);

  function openForm(props = {}) {
    renderTab(props);
    fireEvent.click(screen.getByRole('button', { name: 'Nova atividade' }));
  }

  function openEdit(props = {}) {
    renderTab(props);
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'Editar', hidden: true }),
    );
  }

  function fillRequired() {
    fill(/^Título/, '  Integração sensorial  ');
    fill(/^Tipo/, 'group_session');
    fill(/^Especialidade/, 'occupational_therapist');
    fill(/^Descrição/, 'Circuito sensorial.');
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace });
    fetchMock = jest.fn().mockResolvedValue(respond(201, activity()));
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('lista com tipo, especialidade, frequência, status e data', () => {
    renderTab();

    const row = within(screen.getByText('Integração sensorial').closest('tr')!);
    expect(row.getByText('Sessão terapêutica individual')).toBeInTheDocument();
    expect(row.getByText('Terapeuta ocupacional')).toBeInTheDocument();
    expect(row.getByText('1x por semana, 45 min')).toBeInTheDocument();
    expect(row.getByText('Sugerida')).toHaveClass('badge', 'suggested');
    expect(row.getByText('01/12/2026')).toBeInTheDocument();
    expect(screen.getByText('1 atividade')).toBeInTheDocument();
  });

  it('mostra carregando, vazio e erro com nova tentativa', () => {
    const { rerender } = renderTab({ activities: null });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Carregando atividades...',
    );

    const props = {
      ptsId: 'pts-1',
      reload,
      canCreate: true,
      canEdit: () => true,
      team: TEAM,
      goals: GOALS,
      isAdmin: false,
    };
    rerender(<ActivitiesTab {...props} activities={[]} error={null} />);
    expect(screen.getByText('Nenhuma atividade')).toBeInTheDocument();

    rerender(
      <ActivitiesTab {...props} activities={null} error={new Error('x')} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(reload).toHaveBeenCalled();
  });

  it('sem permissão, não mostra "Nova atividade"', () => {
    renderTab({ canCreate: false });

    expect(
      screen.queryByRole('button', { name: 'Nova atividade' }),
    ).not.toBeInTheDocument();
  });

  it('exige título, descrição e frequência', () => {
    openForm();
    fill('Quantidade', '0');
    submit();

    expect(
      screen.getByText('Informe o título da atividade'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Informe a descrição da atividade'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Informe quantidade, período e duração'),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('cria com a sessão, mostra o carregamento e atualiza a lista', async () => {
    let finish: (value: Response) => void = () => undefined;
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    openForm();
    fillRequired();
    fill('Quantidade', '2');
    fill('Período', 'monthly');
    fill('Duração em minutos', '50');
    fill(/^Meta/, 'goal-1');
    fireEvent.click(screen.getByRole('checkbox', { name: /João Lima/ }));
    submit();

    expect(screen.getByRole('button', { name: 'Salvando...' })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledWith(
      API,
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    expect(sentBody()).toEqual({
      title: 'Integração sensorial',
      description: 'Circuito sensorial.',
      type: 'group_session',
      specialism: 'occupational_therapist',
      frequency: { quantity: 2, period: 'monthly', durationMinutes: 50 },
      modality: 'in_person',
      executor: 'team',
      executorProfessionalIds: ['prof-2'],
      goalId: 'goal-1',
    });

    finish(respond(201, activity()));

    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Atividade sugerida')).toBeInTheDocument();
  });

  it('pede o local só na visita externa', async () => {
    openForm();
    fillRequired();
    expect(screen.queryByLabelText(/^Local da visita/)).not.toBeInTheDocument();

    fill(/^Modalidade/, 'external_visit');
    fill(/^Local da visita/, 'school');
    submit();

    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(sentBody()).toMatchObject({
      modality: 'external_visit',
      visitPlace: 'school',
    });
  });

  it('os profissionais executores só aparecem quando a equipe executa', async () => {
    openForm();
    fillRequired();
    fireEvent.click(screen.getByRole('checkbox', { name: /Ana Souza/ }));
    fill(/^Quem executa/, 'family');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    submit();

    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(sentBody()).toMatchObject({ executor: 'family' });
    expect(sentBody()).not.toHaveProperty('executorProfessionalIds');
  });

  it('só o admin escolhe o autor (RN029)', async () => {
    openForm({ isAdmin: true });
    fillRequired();
    fill(/^Autor/, 'prof-2');
    submit();

    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(sentBody()).toMatchObject({ authorProfessionalId: 'prof-2' });
  });

  it('o profissional não escolhe o autor', () => {
    openForm();

    expect(screen.queryByLabelText(/^Autor/)).not.toBeInTheDocument();
  });

  it('422 mostra a mensagem no campo de frequência', async () => {
    const message =
      'Frequência inválida: informe quantidade, período e duração.';
    fetchMock.mockResolvedValue(
      respond(422, { status: 'INVALID_FREQUENCY', message }),
    );
    openForm();
    fillRequired();
    submit();

    const error = await screen.findByText(message);
    expect(error.closest('.field')).toContainElement(
      screen.getByLabelText('Quantidade'),
    );
    expect(reload).not.toHaveBeenCalled();
  });

  it('os outros erros mostram a mensagem da API', async () => {
    fetchMock.mockResolvedValue(
      respond(409, { status: 'PTS_NOT_EDITABLE', message: 'PTS encerrado.' }),
    );
    openForm();
    fillRequired();
    submit();

    expect(await screen.findByText('PTS encerrado.')).toBeInTheDocument();
  });

  it('vai para o login sem sessão', async () => {
    fetchMock.mockResolvedValue(respond(401, {}));
    openForm();
    fillRequired();
    submit();

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });

  it('mostra "Editar" só na atividade que a pessoa pode editar', () => {
    renderTab({
      activities: [
        activity(),
        activity({ id: 'act-2', title: 'Arquivada', status: 'archived' }),
      ],
      canEdit: (item) => item.status !== 'archived',
    });

    expect(
      screen.getByRole('button', { name: 'Ações para Integração sensorial' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Ações para Arquivada' }),
    ).not.toBeInTheDocument();
  });

  it('edita com o formulário preenchido e atualiza a lista', async () => {
    let finish: (value: Response) => void = () => undefined;
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    openEdit({
      activities: [
        activity({
          goalId: 'goal-1',
          modality: 'external_visit',
          visitPlace: 'school',
        }),
      ],
    });

    expect(
      screen.getByRole('dialog', { name: 'Editar atividade' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Título/)).toHaveValue(
      'Integração sensorial',
    );
    expect(screen.getByLabelText(/^Local da visita/)).toHaveValue('school');
    expect(screen.getByLabelText(/^Meta/)).toHaveValue('goal-1');
    // Especialidade e quem executa não mudam na edição.
    expect(screen.getByLabelText(/^Especialidade/)).toBeDisabled();
    expect(screen.getByLabelText(/^Quem executa/)).toBeDisabled();
    expect(screen.queryByLabelText(/^Autor/)).not.toBeInTheDocument();

    fill(/^Título/, ' Circuito sensorial ');
    fill('Quantidade', '2');
    fill(/^Meta/, '');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(screen.getByRole('button', { name: 'Salvando...' })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/activities/act-1',
      expect.objectContaining({ method: 'PATCH', credentials: 'include' }),
    );
    expect(sentBody()).toEqual({
      title: 'Circuito sensorial',
      description: 'Circuito sensorial.',
      type: 'individual_session',
      frequency: { quantity: 2, period: 'weekly', durationMinutes: 45 },
      modality: 'external_visit',
      visitPlace: 'school',
      goalId: null,
    });

    finish(respond(200, activity({ title: 'Circuito sensorial' })));

    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Atividade salva')).toBeInTheDocument();
  });

  it('na edição, mostra a mensagem de erro da API', async () => {
    const message = 'Atividade rejeitada ou arquivada não pode ser editada.';
    fetchMock.mockResolvedValue(
      respond(409, { status: 'ACTIVITY_NOT_EDITABLE', message }),
    );
    openEdit();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });
});
