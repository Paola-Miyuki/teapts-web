import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

import type { TimelineOrder } from '@/lib/timeline';

import TimelineFilters, {
  EMPTY_TIMELINE_FILTERS,
  periodRange,
  type TimelineFilterValue,
  type TimelineSearch,
} from '../_components/TimelineFilters';

const TEAM = [
  { id: 'prof-1', name: 'Ana Souza' },
  { id: 'prof-2', name: 'João Lima' },
];

function respond(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

// GET /professionals: a busca por nome devolve os profissionais do diretório.
function mockProfessionals(data: { id: string; name: string }[]) {
  const fetchMock = jest.fn().mockResolvedValue(
    respond({
      data,
      pagination: { page: 1, limit: 10, total: data.length, totalPages: 1 },
    }),
  );
  global.fetch = fetchMock;

  return fetchMock;
}

function setup({
  value = EMPTY_TIMELINE_FILTERS,
  order = 'desc',
  searchProfessionals = false,
}: {
  value?: TimelineFilterValue;
  order?: TimelineOrder;
  searchProfessionals?: boolean;
} = {}) {
  const onChange = jest.fn();
  const onOrderChange = jest.fn();
  const search: TimelineSearch = {
    input: '',
    setInput: jest.fn(),
    commit: jest.fn(),
    clear: jest.fn(),
  };

  render(
    <TimelineFilters
      search={search}
      value={value}
      onChange={onChange}
      order={order}
      onOrderChange={onOrderChange}
      searchProfessionals={searchProfessionals}
      team={TEAM}
    />,
  );

  return { onChange, onOrderChange, search };
}

describe('TimelineFilters', () => {
  it('abre e fecha o painel de filtros', () => {
    setup();
    const toggle = screen.getByRole('button', { name: 'Filtros' });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Tipo do evento')).toBeVisible();
  });

  it('repassa a busca, o Enter e o Esc', () => {
    const { search } = setup();
    const input = screen.getByPlaceholderText('Descrição ou autor do evento');

    fireEvent.change(input, { target: { value: 'meta' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(search.setInput).toHaveBeenCalledWith('meta');
    expect(search.commit).toHaveBeenCalled();
    expect(search.clear).toHaveBeenCalled();
  });

  it('ordena pela data do evento e inverte a direção', () => {
    const { onOrderChange } = setup();

    expect(screen.getByLabelText('Ordenar por')).toHaveDisplayValue(
      'Data do evento',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ordem decrescente' }));

    expect(onOrderChange).toHaveBeenCalledWith('asc');
  });

  it('mostra a ordem crescente quando escolhida', () => {
    const { onOrderChange } = setup({ order: 'asc' });

    fireEvent.click(screen.getByRole('button', { name: 'Ordem crescente' }));

    expect(onOrderChange).toHaveBeenCalledWith('desc');
  });

  it('filtra pelos tipos do evento', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));

    fireEvent.click(screen.getByRole('checkbox', { name: 'Atividade' }));

    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_TIMELINE_FILTERS,
      types: ['activity'],
    });
    expect(
      screen
        .getAllByRole('checkbox')
        .map((checkbox) => checkbox.parentElement?.textContent),
    ).toEqual(['PTS', 'Equipe', 'Atividade', 'Atendimento', 'Documento']);
  });

  it('no paciente, escolhe o autor entre a equipe, pelo nome', () => {
    global.fetch = jest.fn();
    const { onChange } = setup();

    fireEvent.change(screen.getByPlaceholderText('Quem executou'), {
      target: { value: 'joão lima' },
    });

    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_TIMELINE_FILTERS,
      authorId: 'prof-2',
    });
    // O paciente não consulta profissionais (RFPRO001).
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('na equipe, busca o autor entre os profissionais depois de 300 ms', async () => {
    jest.useFakeTimers();
    try {
      const fetchMock = mockProfessionals([
        { id: 'prof-9', name: 'Marcos Vieira' },
      ]);
      const { onChange } = setup({ searchProfessionals: true });
      const input = screen.getByPlaceholderText('Quem executou');

      fireEvent.change(input, { target: { value: 'Ma' } });
      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      const url = new URL(fetchMock.mock.calls[0][0]);
      expect(url.pathname).toBe('/professionals');
      expect(url.searchParams.get('name')).toBe('Ma');

      fireEvent.change(input, { target: { value: 'Marcos Vieira' } });

      expect(onChange).toHaveBeenCalledWith({
        ...EMPTY_TIMELINE_FILTERS,
        authorId: 'prof-9',
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('não busca profissionais com menos de 2 caracteres', async () => {
    jest.useFakeTimers();
    try {
      const fetchMock = mockProfessionals([]);
      setup({ searchProfessionals: true });

      fireEvent.change(screen.getByPlaceholderText('Quem executou'), {
        target: { value: 'M' },
      });
      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('mostra o nome do autor que veio da URL', async () => {
    mockProfessionals([{ id: 'prof-9', name: 'Marcos Vieira' }]);
    setup({
      value: { ...EMPTY_TIMELINE_FILTERS, authorId: 'prof-9' },
      searchProfessionals: true,
    });

    expect(
      await screen.findByDisplayValue('Marcos Vieira'),
    ).toBeInTheDocument();
  });

  it('tira o autor quando o nome muda ou é apagado', () => {
    const { onChange } = setup({
      value: { ...EMPTY_TIMELINE_FILTERS, authorId: 'prof-1' },
    });
    const input = screen.getByPlaceholderText('Quem executou');

    expect(input).toHaveValue('Ana Souza');
    fireEvent.change(input, { target: { value: 'Ana' } });

    expect(onChange).toHaveBeenCalledWith(EMPTY_TIMELINE_FILTERS);
  });

  it('mostra as datas só no período personalizado', () => {
    const { onChange } = setup({
      value: { ...EMPTY_TIMELINE_FILTERS, period: 'custom' },
    });

    fireEvent.change(screen.getByLabelText('De'), {
      target: { value: '2026-11-01' },
    });

    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_TIMELINE_FILTERS,
      period: 'custom',
      from: '2026-11-01',
    });
  });

  it('troca o período e zera as datas', () => {
    const { onChange } = setup({
      value: {
        ...EMPTY_TIMELINE_FILTERS,
        period: 'custom',
        from: '2026-11-01',
      },
    });

    fireEvent.change(screen.getByLabelText('Período'), {
      target: { value: '30' },
    });

    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_TIMELINE_FILTERS,
      period: '30',
    });
  });

  it('mostra "Limpar" com filtro e volta tudo ao padrão', () => {
    const onChange = jest.fn();

    // Como na aba: o pai guarda o valor e o repassa.
    function Harness() {
      const [value, setValue] = useState<TimelineFilterValue>({
        ...EMPTY_TIMELINE_FILTERS,
        types: ['document'],
        authorId: 'prof-1',
      });

      return (
        <TimelineFilters
          search={{
            input: '',
            setInput: jest.fn(),
            commit: jest.fn(),
            clear: jest.fn(),
          }}
          value={value}
          onChange={(next) => {
            onChange(next);
            setValue(next);
          }}
          order="desc"
          onOrderChange={jest.fn()}
          searchProfessionals={false}
          team={TEAM}
        />
      );
    }

    render(<Harness />);
    expect(screen.getByPlaceholderText('Quem executou')).toHaveValue(
      'Ana Souza',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));

    expect(onChange).toHaveBeenCalledWith(EMPTY_TIMELINE_FILTERS);
    expect(screen.getByPlaceholderText('Quem executou')).toHaveValue('');
    expect(
      screen.queryByRole('button', { name: 'Limpar' }),
    ).not.toBeInTheDocument();
  });

  it('não mostra "Limpar" sem filtro', () => {
    setup();

    expect(
      screen.queryByRole('button', { name: 'Limpar' }),
    ).not.toBeInTheDocument();
  });
});

describe('periodRange', () => {
  const today = new Date(2026, 10, 23);

  it('conta os últimos 30 e 90 dias a partir de hoje', () => {
    expect(periodRange({ period: '30', from: '', to: '' }, today)).toEqual({
      from: '2026-10-24',
      to: '',
    });
    expect(periodRange({ period: '90', from: '', to: '' }, today)).toEqual({
      from: '2026-08-25',
      to: '',
    });
  });

  it('usa as datas do período personalizado', () => {
    expect(
      periodRange(
        { period: 'custom', from: '2026-11-01', to: '2026-11-10' },
        today,
      ),
    ).toEqual({ from: '2026-11-01', to: '2026-11-10' });
  });

  it('sem período, não filtra por data', () => {
    expect(periodRange({ period: '', from: 'x', to: 'y' }, today)).toEqual({
      from: '',
      to: '',
    });
  });
});
