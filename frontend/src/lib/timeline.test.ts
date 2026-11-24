import {
  formatTimelineTime,
  getTimeline,
  groupTimelineByDay,
  timelineLink,
  type TimelineRecord,
} from './timeline';

const record = (overrides: Partial<TimelineRecord>): TimelineRecord => ({
  id: 'rec-1',
  type: 'activity_approved',
  targetType: 'activity',
  targetId: 'act-1',
  description: 'Aprovou a atividade',
  happenedAt: '2026-11-12T17:45:00.000Z',
  author: { id: 'acc-1', name: 'Ana Souza' },
  assignedTo: null,
  ...overrides,
});

describe('getTimeline', () => {
  it('monta a URL só com os filtros informados', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ data: [], pagination: {} }),
    });
    global.fetch = fetchMock;

    await getTimeline('pts 1', {
      page: 2,
      limit: 25,
      q: 'meta',
      types: ['activity', 'document'],
      authorId: 'prof-1',
      from: '2026-11-01',
      to: '',
      order: 'asc',
    });

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe('/pts/pts%201/timeline');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: '2',
      limit: '25',
      q: 'meta',
      type: 'activity,document',
      authorId: 'prof-1',
      from: '2026-11-01',
      order: 'asc',
    });
  });
});

describe('formatos da timeline', () => {
  it('mostra a hora no horário de Brasília', () => {
    expect(formatTimelineTime('2026-11-12T17:45:00.000Z')).toBe('14:45');
  });

  it('agrupa por dia no horário de Brasília, mantendo a ordem', () => {
    const groups = groupTimelineByDay([
      record({ id: 'a', happenedAt: '2026-11-12T17:45:00.000Z' }),
      // 01:30 UTC de 12/11 ainda é 11/11 em Brasília.
      record({ id: 'b', happenedAt: '2026-11-12T01:30:00.000Z' }),
      record({ id: 'c', happenedAt: '2026-11-11T12:00:00.000Z' }),
    ]);

    expect(
      groups.map((group) => [group.day, group.records.map((r) => r.id)]),
    ).toEqual([
      ['12/11/2026', ['a']],
      ['11/11/2026', ['b', 'c']],
    ]);
  });
});

describe('timelineLink', () => {
  it.each([
    [
      'appointment',
      'appointment_registered',
      'Ver atendimento',
      '#atendimentos',
    ],
    ['activity', 'activity_suspended', 'Ver atividade', '#atividades'],
    ['pts', 'goal_updated', 'Ver meta', '#metas'],
    [
      'document',
      'document_uploaded',
      'Ver documento',
      '/patients/p-1#documentos',
    ],
  ] as const)('liga o evento %s (%s)', (targetType, type, label, href) => {
    expect(timelineLink(record({ targetType, type }), 'p-1')).toEqual({
      label,
      href,
    });
  });

  it('não liga eventos da ficha nem da equipe', () => {
    expect(
      timelineLink(record({ targetType: 'pts', type: 'pts_started' }), 'p-1'),
    ).toBeNull();
    expect(
      timelineLink(
        record({ targetType: 'team_member', type: 'member_removed' }),
        'p-1',
      ),
    ).toBeNull();
  });

  it('não liga evento sem alvo (documento para o paciente)', () => {
    expect(
      timelineLink(record({ targetType: 'document', targetId: null }), 'p-1'),
    ).toBeNull();
  });
});
