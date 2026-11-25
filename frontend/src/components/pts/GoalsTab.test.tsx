import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useRouter } from 'next/navigation';

import type { Goal } from '@/lib/goals';

import GoalsTab from './GoalsTab';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const goal = (overrides: Partial<Goal> = {}): Goal => ({
  id: 'goal-1',
  title: 'Ampliar a comunicação funcional',
  description: 'Fazer pedidos simples com pranchas de CAA ou fala.',
  term: 'short',
  area: 'communication',
  measureCriterion: '5 pedidos por dia, em 4 de 5 dias.',
  targetDate: '2099-11-30',
  status: 'in_progress',
  resultNote: null,
  origin: 'new',
  activitiesCount: 0,
  registeredBy: { id: 'prof-2', name: 'João Lima' },
  createdAt: '2026-02-14T12:00:00.000Z',
  ...overrides,
});

const GOALS = [
  goal(),
  goal({
    id: 'goal-2',
    title: 'Reduzir as crises no recreio',
    area: 'motor_sensory',
    targetDate: '2020-11-15',
    activitiesCount: 3,
  }),
  goal({
    id: 'goal-3',
    title: 'Autonomia na rotina escolar',
    area: 'cognitive',
    term: 'long',
    status: 'partially_achieved',
  }),
];

const TEAM = [
  { id: 'prof-1', name: 'Ana Souza, Psicólogo' },
  { id: 'prof-2', name: 'João Lima, Fonoaudiólogo' },
];

function respond(status: number, body: unknown) {
  return {
    ok: status < 400,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

const API = 'http://localhost:3000/pts/pts-1/goals';
const row = (title: string) => screen.getByText(title).closest('tr')!;
const menuItem = (title: string, name: string) =>
  within(row(title)).getByRole('menuitem', { name, hidden: true });
const dialog = (name: string | RegExp) => screen.getByRole('dialog', { name });

describe('GoalsTab (RFPTS012)', () => {
  const replace = jest.fn();
  const reload = jest.fn();
  let fetchMock: jest.Mock;

  function renderTab(
    props: Partial<React.ComponentProps<typeof GoalsTab>> = {},
  ) {
    return render(
      <GoalsTab
        ptsId="pts-1"
        goals={GOALS}
        error={null}
        reload={reload}
        nextReviewAt="2100-03-31"
        canManage
        {...props}
      />,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ replace });
    fetchMock = jest.fn().mockResolvedValue(respond(200, {}));
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  describe('lista', () => {
    it('agrupa por prazo, com a quantidade de cada grupo', () => {
      renderTab();

      expect(screen.getByText('3 metas')).toBeInTheDocument();
      expect(
        screen.getByRole('button', {
          name: 'Curto prazo (até 3 meses) 2 metas',
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Longo prazo 1 meta' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /Médio prazo/ }),
      ).not.toBeInTheDocument();
    });

    it('mostra área, data-alvo, situação e atividades, com a vencida em destaque', () => {
      renderTab();

      const overdue = within(row('Reduzir as crises no recreio'));
      expect(overdue.getByText('Motor/Sensorial')).toBeInTheDocument();
      expect(overdue.getByText('15/11/2020')).toHaveClass('ux-overdue');
      expect(overdue.getByText('Em andamento')).toHaveClass('badge', 'running');
      expect(overdue.getByRole('link', { name: '3' })).toHaveAttribute(
        'href',
        '#atividades',
      );
      expect(
        within(row('Ampliar a comunicação funcional')).getByText('30/11/2099'),
      ).not.toHaveClass('ux-overdue');
      expect(
        within(row('Autonomia na rotina escolar')).getByText(
          'Parcialmente atingida',
        ),
      ).toHaveClass('badge', 'partial');
    });

    it('abre e fecha o grupo', () => {
      renderTab();

      const toggle = screen.getByRole('button', { name: /Curto prazo/ });
      fireEvent.click(toggle);

      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(row('Ampliar a comunicação funcional')).toHaveClass(
        'is-collapsed',
      );
      expect(row('Autonomia na rotina escolar')).not.toHaveClass(
        'is-collapsed',
      );
    });

    it('busca pelo título e mostra o vazio', () => {
      renderTab();
      const search = screen.getByPlaceholderText('Título da meta');

      fireEvent.change(search, { target: { value: 'AUTONOMIA' } });
      expect(
        screen.queryByText('Ampliar a comunicação funcional'),
      ).not.toBeInTheDocument();
      expect(
        screen.getByText('Autonomia na rotina escolar'),
      ).toBeInTheDocument();

      fireEvent.change(search, { target: { value: 'zzz' } });
      expect(screen.getByText('Nenhuma meta')).toBeInTheDocument();
    });

    it('avisa a meta da nova versão sem prazo nem data-alvo', () => {
      renderTab({
        goals: [goal({ term: null, targetDate: null, origin: 'kept_partial' })],
      });

      expect(
        screen.getByRole('button', { name: 'Defina o prazo 1 meta' }),
      ).toBeInTheDocument();
      expect(screen.getByText('Defina a data-alvo')).toBeInTheDocument();
    });

    it('pagina as metas', () => {
      renderTab({
        goals: Array.from({ length: 11 }, (_, index) =>
          goal({ id: `g-${index}`, title: `Meta ${index + 1}` }),
        ),
      });

      expect(screen.queryByText('Meta 11')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }));
      expect(screen.getByText('Meta 11')).toBeInTheDocument();
    });

    it('mostra carregando e o erro com nova tentativa', () => {
      const { rerender } = renderTab({ goals: null });
      expect(screen.getByRole('status')).toHaveTextContent(
        'Carregando metas...',
      );

      rerender(
        <GoalsTab
          ptsId="pts-1"
          goals={null}
          error={new Error('offline')}
          reload={reload}
          canManage
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
      expect(reload).toHaveBeenCalled();
    });
  });

  it('sem permissão (paciente), só visualiza', () => {
    renderTab({ canManage: false });

    expect(
      screen.queryByRole('button', { name: 'Adicionar meta' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryAllByRole('menuitem', { name: 'Editar', hidden: true }),
    ).toHaveLength(0);
    expect(
      screen.queryAllByRole('menuitem', { name: 'Excluir', hidden: true }),
    ).toHaveLength(0);

    fireEvent.click(menuItem('Ampliar a comunicação funcional', 'Visualizar'));

    const view = within(dialog('Ampliar a comunicação funcional'));
    expect(
      view.queryByRole('button', { name: 'Editar' }),
    ).not.toBeInTheDocument();
    expect(
      view.queryByRole('button', { name: 'Excluir' }),
    ).not.toBeInTheDocument();
  });

  it('visualiza descrição, critério, origem e autoria, e passa para a edição', () => {
    renderTab();

    fireEvent.click(menuItem('Ampliar a comunicação funcional', 'Visualizar'));

    const view = within(dialog('Ampliar a comunicação funcional'));
    expect(
      view.getByText('Fazer pedidos simples com pranchas de CAA ou fala.'),
    ).toBeInTheDocument();
    expect(
      view.getByText('5 pedidos por dia, em 4 de 5 dias.'),
    ).toBeInTheDocument();
    expect(view.getByText('Nova')).toBeInTheDocument();
    expect(view.getByText('João Lima, em 14/02/2026')).toBeInTheDocument();
    expect(
      view.getByText('Marcado na reavaliação do fim do ciclo'),
    ).toBeInTheDocument();

    fireEvent.click(view.getByRole('button', { name: 'Editar' }));
    expect(dialog('Editar meta')).toBeInTheDocument();
  });

  describe('adicionar e editar', () => {
    const fill = (label: RegExp, value: string) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } });

    function openAdd(props = {}) {
      renderTab(props);
      fireEvent.click(screen.getByRole('button', { name: 'Adicionar meta' }));
    }

    function fillAll() {
      fill(/^Meta \(título\)/, '  Conversa curta  ');
      fill(/^Prazo/, 'medium');
      fill(/^Área/, 'social');
      fill(/^Meta \(descrição\)/, 'Conversar por 3 turnos.');
      fill(/^Critério de medida/, '3 por semana');
      fill(/^Data-alvo/, '2100-02-28');
    }

    const submit = (name = 'Adicionar meta') =>
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', { name }),
      );

    it('exige os campos e a data-alvo até a próxima revisão', () => {
      openAdd();
      submit();

      for (const message of [
        'Informe o título da meta',
        'Informe a descrição da meta',
        'Informe o critério de medida',
        'Informe a data-alvo',
      ]) {
        expect(screen.getByText(message)).toBeInTheDocument();
      }

      fillAll();
      fill(/^Data-alvo/, '2100-04-01');
      submit();

      expect(
        screen.getByText('A data-alvo vai até a próxima revisão (31/03/2100)'),
      ).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('cadastra com a sessão, mostra o carregamento e atualiza a lista', async () => {
      let finish: (value: Response) => void = () => undefined;
      fetchMock.mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
      openAdd();
      fillAll();
      submit();

      expect(
        screen.getByRole('button', { name: 'Salvando...' }),
      ).toBeDisabled();
      expect(fetchMock).toHaveBeenCalledWith(
        API,
        expect.objectContaining({ method: 'POST', credentials: 'include' }),
      );
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
        title: 'Conversa curta',
        term: 'medium',
        area: 'social',
        description: 'Conversar por 3 turnos.',
        measureCriterion: '3 por semana',
        targetDate: '2100-02-28',
      });

      finish(respond(201, goal()));

      await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText('Meta adicionada')).toBeInTheDocument();
    });

    it('o admin atribui a autoria a um membro (RN029)', async () => {
      openAdd({ authors: TEAM });
      fillAll();
      expect(screen.getByLabelText(/^Autor/)).toHaveValue('');
      fill(/^Autor/, 'prof-2');
      submit();

      await waitFor(() => expect(reload).toHaveBeenCalled());
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
        authorProfessionalId: 'prof-2',
      });
    });

    it('o profissional não escolhe o autor', () => {
      openAdd();

      expect(screen.queryByLabelText(/^Autor/)).not.toBeInTheDocument();
    });

    it('edita pelo PATCH, com os campos preenchidos', async () => {
      renderTab({ authors: TEAM });
      fireEvent.click(menuItem('Ampliar a comunicação funcional', 'Editar'));

      expect(screen.getByLabelText(/^Meta \(título\)/)).toHaveValue(
        'Ampliar a comunicação funcional',
      );
      expect(screen.queryByLabelText(/^Autor/)).not.toBeInTheDocument();
      fill(/^Meta \(título\)/, 'Outro título');
      submit('Salvar alterações');

      await waitFor(() => expect(reload).toHaveBeenCalled());
      expect(fetchMock).toHaveBeenCalledWith(
        `${API}/goal-1`,
        expect.objectContaining({ method: 'PATCH', credentials: 'include' }),
      );
      expect(screen.getByText('Meta salva')).toBeInTheDocument();
    });

    it('mostra o erro da API no modal', async () => {
      fetchMock.mockResolvedValue(
        respond(409, { status: 'PTS_NOT_EDITABLE', message: 'PTS encerrado.' }),
      );
      openAdd();
      fillAll();
      submit();

      expect(await screen.findByText('PTS encerrado.')).toBeInTheDocument();
      expect(reload).not.toHaveBeenCalled();
    });

    it('vai para o login sem sessão', async () => {
      fetchMock.mockResolvedValue(respond(401, {}));
      openAdd();
      fillAll();
      submit();

      await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    });
  });

  describe('excluir', () => {
    const TITLE = 'Ampliar a comunicação funcional';
    const confirm = () =>
      fireEvent.click(screen.getByRole('button', { name: 'Excluir meta' }));

    it('confirma, exclui e atualiza a lista', async () => {
      renderTab();
      fireEvent.click(menuItem(TITLE, 'Excluir'));
      expect(dialog('Excluir a meta?')).toBeInTheDocument();
      confirm();

      expect(
        screen.getByRole('button', { name: 'Excluindo...' }),
      ).toBeDisabled();
      await waitFor(() => expect(reload).toHaveBeenCalled());
      expect(fetchMock).toHaveBeenCalledWith(
        `${API}/goal-1`,
        expect.objectContaining({ method: 'DELETE', credentials: 'include' }),
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText('Meta excluída')).toBeInTheDocument();
    });

    it.each([
      ['LAST_GOAL', 'O PTS precisa ter ao menos uma meta.'],
      ['GOAL_HAS_ACTIVITIES', 'A meta tem atividades ligadas.'],
    ])('mostra a mensagem da API no 409 %s', async (status, message) => {
      fetchMock.mockResolvedValue(respond(409, { status, message }));
      renderTab();
      fireEvent.click(menuItem(TITLE, 'Excluir'));
      confirm();

      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(dialog('Excluir a meta?')).toBeInTheDocument();
      expect(reload).not.toHaveBeenCalled();
    });

    it('pede para desligar as atividades antes, sem chamar a API', () => {
      renderTab();
      fireEvent.click(menuItem('Reduzir as crises no recreio', 'Excluir'));

      const blocked = within(dialog('Desligue as atividades antes'));
      expect(
        blocked.getByText(/Esta meta tem 3 atividades ligadas/),
      ).toBeInTheDocument();
      expect(
        blocked.queryByRole('button', { name: 'Excluir meta' }),
      ).not.toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
