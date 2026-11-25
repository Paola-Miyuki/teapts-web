import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useRouter } from 'next/navigation';

import type { Activity, ActivityStatus } from '@/lib/activities';

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
const PAGINATION = { page: 1, limit: 10, total: 1, totalPages: 1 };

function respond(status: number, body: unknown) {
  return {
    ok: status < 400,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('ActivitiesTab (RFACT001, RFACT005, RFACT008, RFACT009)', () => {
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
        pagination={PAGINATION}
        error={null}
        reload={reload}
        canCreate
        canEdit={() => true}
        canArchive={() => true}
        canRegister={() => false}
        canChangeStatus={() => true}
        team={TEAM}
        goals={GOALS}
        isAdmin={false}
        statusFilter={['suggested', 'running', 'suspended']}
        onStatusFilterChange={jest.fn()}
        executorFilter={undefined}
        onExecutorFilterChange={jest.fn()}
        onClearFilters={jest.fn()}
        page={1}
        limit={10}
        onPageChange={jest.fn()}
        onLimitChange={jest.fn()}
        {...props}
      />,
    );
  }

  const fill = (label: RegExp | string, value: string) =>
    fireEvent.change(within(screen.getByRole('dialog')).getByLabelText(label), {
      target: { value },
    });
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
      canArchive: () => true,
      canRegister: () => false,
      canChangeStatus: () => true,
      team: TEAM,
      goals: GOALS,
      isAdmin: false,
      pagination: { ...PAGINATION, total: 0, totalPages: 0 },
      statusFilter: ['suggested', 'running', 'suspended'] as ActivityStatus[],
      onStatusFilterChange: jest.fn(),
      executorFilter: undefined,
      onExecutorFilterChange: jest.fn(),
      onClearFilters: jest.fn(),
      page: 1,
      limit: 10,
      onPageChange: jest.fn(),
      onLimitChange: jest.fn(),
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
    expect(
      within(screen.getByRole('dialog')).queryByRole('checkbox'),
    ).not.toBeInTheDocument();
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
    const archivedRow = screen.getByRole('row', { name: /Arquivada/ });
    fireEvent.click(
      within(archivedRow).getByRole('button', {
        name: 'Ações para Arquivada',
      }),
    );
    expect(
      within(archivedRow).getByRole('menuitem', {
        name: 'Visualizar',
        hidden: true,
      }),
    ).toBeInTheDocument();
    expect(
      within(archivedRow).queryByRole('menuitem', {
        name: 'Editar',
        hidden: true,
      }),
    ).not.toBeInTheDocument();
  });

  it('filtra por status e executor, limpa e permite paginar', () => {
    const onStatusFilterChange = jest.fn();
    const onExecutorFilterChange = jest.fn();
    const onClearFilters = jest.fn();
    const onPageChange = jest.fn();

    renderTab({
      pagination: { page: 1, limit: 10, total: 21, totalPages: 3 },
      statusFilter: ['suggested', 'running', 'suspended'],
      onStatusFilterChange,
      onExecutorFilterChange,
      onClearFilters,
      onPageChange,
    });

    // A contagem é a do filtro inteiro, não a da página.
    expect(screen.getByText('21 atividades')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    expect(
      screen.getAllByLabelText(/^Status: /, { selector: 'summary' }),
    ).toHaveLength(1);
    expect(screen.getByLabelText('Sugerida')).toBeChecked();
    expect(screen.getByLabelText('Arquivada')).not.toBeChecked();
    fireEvent.click(screen.getByLabelText('Sugerida'));
    expect(onStatusFilterChange).toHaveBeenLastCalledWith([
      'running',
      'suspended',
    ]);
    fireEvent.click(screen.getByLabelText('Arquivada'));
    expect(onStatusFilterChange).toHaveBeenLastCalledWith([
      'suggested',
      'running',
      'suspended',
      'archived',
    ]);
    fireEvent.change(screen.getByLabelText('Quem executa'), {
      target: { value: 'family' },
    });
    expect(onExecutorFilterChange).toHaveBeenCalledWith('family');
    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Página 2' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('mostra tudo o que a API devolveu, seja qual for o status', () => {
    renderTab({
      statusFilter: [],
      activities: [
        activity({ id: 'act-2', title: 'Hidroterapia', status: 'concluded' }),
        activity({ id: 'act-3', title: 'Grupo de pais', status: 'rejected' }),
      ],
    });

    expect(screen.getByText('Hidroterapia')).toBeInTheDocument();
    expect(screen.getByText('Grupo de pais')).toBeInTheDocument();
  });

  it('na página que ficou vazia, mantém a paginação', () => {
    const onPageChange = jest.fn();
    renderTab({
      activities: [],
      page: 2,
      pagination: { page: 2, limit: 10, total: 10, totalPages: 1 },
      onPageChange,
    });

    expect(
      screen.getByText('Nenhuma atividade nesta página'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Página 1' }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  describe('modal "Visualizar"', () => {
    const openView = (
      overrides: Partial<Activity> = {},
      props: Partial<React.ComponentProps<typeof ActivitiesTab>> = {},
    ) => {
      const item = activity(overrides);
      fetchMock.mockResolvedValue(
        respond(200, {
          ...item,
          goal: null,
          documents: [],
          appointmentsCount: 0,
        }),
      );
      renderTab({ activities: [item], ...props });
      fireEvent.click(
        screen.getByRole('menuitem', { name: 'Visualizar', hidden: true }),
      );

      return screen.findByText('Quem executa', { selector: 'h3' });
    };

    it('quem só lê (paciente) abre o detalhe, sem nenhuma ação', async () => {
      await openView(
        {},
        {
          canEdit: () => false,
          canArchive: () => false,
          canChangeStatus: () => false,
        },
      );

      const dialog = within(screen.getByRole('dialog'));
      expect(
        dialog.queryByRole('button', { name: /Editar|Suspender|Concluir/ }),
      ).not.toBeInTheDocument();
      expect(dialog.getByText('Sugerida por')).toBeInTheDocument();
    });

    it('sem executores vale o autor, só quando a equipe executa', async () => {
      await openView({ executor: 'team' });
      expect(
        screen.getByText('Profissionais executores').nextSibling,
      ).toHaveTextContent('João Lima');
    });

    it('com a família executando, não mostra profissional', async () => {
      await openView({ executor: 'family' });
      expect(
        screen.queryByText('Profissionais executores'),
      ).not.toBeInTheDocument();
    });

    it('não mostra o id de quem saiu da equipe', async () => {
      await openView({ authorProfessionalId: 'prof-x' });
      expect(screen.queryByText(/prof-x/)).not.toBeInTheDocument();
    });

    it.each([
      ['Editar', 'Editar atividade'],
      ['Suspender', 'Suspender Integração sensorial?'],
      ['Concluir', 'Concluir Integração sensorial?'],
    ])('abre %s pelo modal (RFACT009)', async (name, title) => {
      await openView(
        { status: 'running' },
        { canChangeStatus: (_activity, action) => action !== 'resume' },
      );
      const dialog = within(screen.getByRole('dialog'));
      expect(
        dialog.queryByRole('button', { name: 'Retomar' }),
      ).not.toBeInTheDocument();
      fireEvent.click(dialog.getByRole('button', { name }));

      expect(screen.getByRole('dialog', { name: title })).toBeInTheDocument();
    });
  });

  it('abre o detalhe em modo somente leitura', async () => {
    fetchMock.mockResolvedValue(
      respond(200, {
        ...activity(),
        goal: null,
        documents: [{ id: 'doc-1', title: 'Laudo terapêutico' }],
        appointmentsCount: 2,
      }),
    );
    renderTab({ canEdit: () => false });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ações para Integração sensorial',
      }),
    );
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'Visualizar', hidden: true }),
    );

    expect(await screen.findByText('Como é feita')).toBeInTheDocument();
    expect(screen.getByText('Laudo terapêutico')).toBeInTheDocument();
    expect(screen.getByText('2', { selector: 'dd' })).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'Editar', hidden: true }),
    ).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/activities/act-1',
      expect.objectContaining({ credentials: 'include' }),
    );
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
    expect(
      within(screen.getByRole('dialog')).getByLabelText(/^Quem executa/),
    ).toBeDisabled();
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

  it('mostra "Arquivar" só na atividade que a pessoa pode arquivar', () => {
    renderTab({
      activities: [
        activity(),
        activity({ id: 'act-2', title: 'Hidroterapia', status: 'suspended' }),
      ],
      canArchive: (item) => item.status === 'suggested',
    });
    const archive = (title: string) =>
      within(screen.getByText(title).closest('tr')!).queryByRole('menuitem', {
        name: 'Arquivar',
        hidden: true,
      });

    expect(archive('Integração sensorial')).toBeInTheDocument();
    expect(archive('Hidroterapia')).not.toBeInTheDocument();
  });

  it('arquiva com o motivo, mostra o carregamento e tira da lista', async () => {
    let finish: (value: Response) => void = () => undefined;
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderTab();
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'Arquivar', hidden: true }),
    );

    expect(
      screen.getByRole('dialog', { name: 'Arquivar Integração sensorial?' }),
    ).toBeInTheDocument();
    fill(/^Motivo/, '  Família assumiu a atividade em casa.  ');
    fireEvent.click(screen.getByRole('button', { name: 'Arquivar atividade' }));

    expect(
      screen.getByRole('button', { name: 'Arquivando...' }),
    ).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/activities/act-1/archive',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    expect(sentBody()).toEqual({
      reason: 'Família assumiu a atividade em casa.',
    });

    finish(
      respond(200, {
        id: 'act-1',
        status: 'archived',
        archivedAt: '2026-12-06T12:00:00.000Z',
      }),
    );

    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Atividade arquivada')).toBeInTheDocument();
  });

  it('arquiva sem motivo', async () => {
    fetchMock.mockResolvedValue(
      respond(200, {
        id: 'act-1',
        status: 'archived',
        archivedAt: '2026-12-06T12:00:00.000Z',
      }),
    );
    renderTab();
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'Arquivar', hidden: true }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Arquivar atividade' }));

    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(sentBody()).toEqual({});
  });

  it('no arquivamento, mostra a mensagem de erro da API', async () => {
    const message =
      'Atividade rejeitada, concluída ou já arquivada não pode ser arquivada.';
    fetchMock.mockResolvedValue(
      respond(409, { status: 'ACTIVITY_NOT_ARCHIVABLE', message }),
    );
    renderTab();
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'Arquivar', hidden: true }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Arquivar atividade' }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });

  describe('aprovar e rejeitar (RFACT003)', () => {
    const item = (name: string) =>
      screen.queryByRole('menuitem', { name, hidden: true });
    const openAction = (name: string) => {
      renderTab({ activities: [activity({ status: 'suggested' })] });
      fireEvent.click(item(name)!);
    };
    const decisionOnly = (
      current: Activity,
      action: 'approve' | 'reject' | 'suspend' | 'resume' | 'conclude',
    ) =>
      current.status === 'suggested' &&
      (action === 'approve' || action === 'reject');

    it('mostra "Aprovar" e "Rejeitar" só na sugerida', () => {
      renderTab({
        activities: [
          activity(),
          activity({ id: 'act-2', title: 'Em execução', status: 'running' }),
        ],
        canEdit: () => false,
        canArchive: () => false,
        canChangeStatus: decisionOnly,
      });

      expect(
        screen.getAllByRole('menuitem', { name: 'Aprovar', hidden: true }),
      ).toHaveLength(1);
      expect(
        screen.getAllByRole('menuitem', { name: 'Rejeitar', hidden: true }),
      ).toHaveLength(1);
      expect(
        screen.queryByRole('button', { name: 'Ações para Em execução' }),
      ).toBeInTheDocument();
      const running = within(screen.getByText('Em execução').closest('tr')!);
      expect(
        running.queryByRole('menuitem', { name: 'Aprovar', hidden: true }),
      ).not.toBeInTheDocument();
    });

    it('aprova sem pedir motivo e atualiza a lista', async () => {
      let finish: (value: Response) => void = () => undefined;
      fetchMock.mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
      openAction('Aprovar');

      expect(
        screen.getByRole('dialog', { name: 'Aprovar Integração sensorial?' }),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText(/^Motivo/)).not.toBeInTheDocument();
      const confirm = screen.getByRole('button', { name: 'Aprovar atividade' });
      expect(confirm).toHaveClass('btn-primary');
      fireEvent.click(confirm);

      expect(
        screen.getByRole('button', { name: 'Aprovando...' }),
      ).toBeDisabled();
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/activities/act-1/approve',
        expect.objectContaining({ method: 'POST', credentials: 'include' }),
      );
      expect(sentBody()).toEqual({});

      finish(
        respond(200, {
          id: 'act-1',
          status: 'running',
          decidedAt: '2026-12-02T12:00:00.000Z',
        }),
      );
      await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
      expect(screen.getByText('Atividade aprovada')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('rejeita com o motivo', async () => {
      fetchMock.mockResolvedValue(
        respond(200, {
          id: 'act-1',
          status: 'rejected',
          decidedAt: '2026-12-02T12:00:00.000Z',
        }),
      );
      openAction('Rejeitar');

      expect(
        screen.getByRole('dialog', { name: 'Rejeitar Integração sensorial?' }),
      ).toBeInTheDocument();
      fill(/^Motivo/, '  Já existe atividade equivalente. ');
      fireEvent.click(
        screen.getByRole('button', { name: 'Rejeitar atividade' }),
      );

      expect(
        await screen.findByText('Atividade rejeitada'),
      ).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/activities/act-1/reject',
        expect.objectContaining({ method: 'POST', credentials: 'include' }),
      );
      expect(sentBody()).toEqual({
        reason: 'Já existe atividade equivalente.',
      });
      expect(reload).toHaveBeenCalledTimes(1);
    });

    it('mostra a mensagem de erro da API', async () => {
      const message = 'Só uma atividade sugerida recebe decisão.';
      fetchMock.mockResolvedValue(
        respond(409, { status: 'ACTIVITY_NOT_SUGGESTED', message }),
      );
      openAction('Aprovar');
      fireEvent.click(
        screen.getByRole('button', { name: 'Aprovar atividade' }),
      );

      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(reload).not.toHaveBeenCalled();
    });
  });

  describe('suspender, retomar e concluir (RFACT009)', () => {
    const item = (name: string) =>
      screen.queryByRole('menuitem', { name, hidden: true });
    const openAction = (name: string, status: Activity['status']) => {
      renderTab({ activities: [activity({ status })] });
      fireEvent.click(item(name)!);
    };

    it('mostra só as ações que a pessoa pode fazer na atividade', () => {
      renderTab({
        activities: [activity({ status: 'running' })],
        canEdit: () => false,
        canArchive: () => false,
        canChangeStatus: (_activity, action) => action !== 'resume',
      });

      expect(item('Suspender')).toBeInTheDocument();
      expect(item('Concluir')).toBeInTheDocument();
      expect(item('Retomar')).not.toBeInTheDocument();
      expect(item('Editar')).not.toBeInTheDocument();
    });

    it('suspende com o motivo, mostra o carregamento e atualiza a lista', async () => {
      let finish: (value: Response) => void = () => undefined;
      fetchMock.mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
      openAction('Suspender', 'running');

      expect(
        screen.getByRole('dialog', { name: 'Suspender Integração sensorial?' }),
      ).toBeInTheDocument();
      fill(/^Motivo/, '  Reforma da sala. ');
      fireEvent.click(
        screen.getByRole('button', { name: 'Suspender atividade' }),
      );

      expect(
        screen.getByRole('button', { name: 'Suspendendo...' }),
      ).toBeDisabled();
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/activities/act-1/suspend',
        expect.objectContaining({ method: 'POST', credentials: 'include' }),
      );
      expect(sentBody()).toEqual({ reason: 'Reforma da sala.' });

      finish(respond(200, { id: 'act-1', status: 'suspended' }));
      await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
      expect(screen.getByText('Atividade suspensa')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it.each([
      ['Retomar', 'suspended', 'resume', 'Atividade retomada'],
      ['Concluir', 'running', 'conclude', 'Atividade concluída'],
      ['Concluir', 'suspended', 'conclude', 'Atividade concluída'],
    ] as const)(
      '%s a %s, sem pedir motivo',
      async (name, status, path, message) => {
        openAction(name, status);

        expect(screen.queryByLabelText(/^Motivo/)).not.toBeInTheDocument();
        const confirm = screen.getByRole('button', {
          name: `${name} atividade`,
        });
        expect(confirm).toHaveClass('btn-primary');
        fireEvent.click(confirm);

        expect(await screen.findByText(message)).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledWith(
          `http://localhost:3000/activities/act-1/${path}`,
          expect.objectContaining({ method: 'POST', credentials: 'include' }),
        );
        expect(reload).toHaveBeenCalledTimes(1);
      },
    );

    it('mostra a mensagem de erro da API', async () => {
      const message =
        'A atividade não está em um estado que permita esta ação.';
      fetchMock.mockResolvedValue(
        respond(409, { status: 'INVALID_ACTIVITY_TRANSITION', message }),
      );
      openAction('Concluir', 'running');
      fireEvent.click(
        screen.getByRole('button', { name: 'Concluir atividade' }),
      );

      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(reload).not.toHaveBeenCalled();
    });

    it('sem sessão, vai para o login', async () => {
      fetchMock.mockResolvedValue(respond(401, {}));
      openAction('Retomar', 'suspended');
      fireEvent.click(
        screen.getByRole('button', { name: 'Retomar atividade' }),
      );

      await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    });
  });

  describe('registrar atendimento (RFACT004)', () => {
    const href = '/appointments/new?pts=pts-1&activity=act-1';

    it('leva à página com a atividade escolhida, pela linha e pelo modal', async () => {
      fetchMock.mockResolvedValue(
        respond(200, {
          ...activity({ status: 'running' }),
          goal: null,
          documents: [],
          appointmentsCount: 0,
        }),
      );
      renderTab({
        activities: [
          activity({ status: 'running' }),
          activity({ id: 'act-2', title: 'Hidroterapia' }),
        ],
        canRegister: (item) => item.status === 'running',
      });

      const items = screen.getAllByRole('menuitem', {
        name: 'Registrar atendimento',
        hidden: true,
      });
      expect(items).toHaveLength(1);
      expect(items[0]).toHaveAttribute('href', href);

      fireEvent.click(
        screen.getAllByRole('menuitem', {
          name: 'Visualizar',
          hidden: true,
        })[0],
      );
      expect(
        await within(screen.getByRole('dialog')).findByRole('link', {
          name: 'Registrar atendimento',
        }),
      ).toHaveAttribute('href', href);
    });
  });
});
