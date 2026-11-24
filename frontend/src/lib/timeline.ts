// Timeline do PTS (RFTL001): cliente de GET /pts/:id/timeline, rótulos e
// formatos da aba Timeline (propriedades-front.md, 3.8).

import { request } from '@/lib/api';

/** Tipo do evento na tela: é o alvo do registro (`targetType`). */
export type TimelineTargetType =
  'pts' | 'activity' | 'appointment' | 'team_member' | 'document';

export type TimelinePerson = { id: string; name: string };

/** Ordem pela data do evento; sem ela, a API usa `desc`. */
export type TimelineOrder = 'asc' | 'desc';

export type TimelineRecord = {
  id: string;
  type: string;
  targetType: TimelineTargetType;
  // Nulo para o paciente nos eventos de documento (RN028).
  targetId: string | null;
  description: string;
  happenedAt: string;
  author: TimelinePerson;
  // Profissional atribuído quando o admin age em nome dele (RN029).
  assignedTo: TimelinePerson | null;
};

export type TimelineResponse = {
  data: TimelineRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type TimelineQuery = {
  page: number;
  limit: number;
  q?: string;
  types?: TimelineTargetType[];
  authorId?: string;
  from?: string;
  to?: string;
  order?: TimelineOrder;
  signal?: AbortSignal;
};

/** Ordem e rótulos do filtro "Tipo do evento" (eventos de meta e da ficha entram como PTS). */
export const TIMELINE_TYPE_LABELS: Record<TimelineTargetType, string> = {
  pts: 'PTS',
  team_member: 'Equipe',
  activity: 'Atividade',
  appointment: 'Atendimento',
  document: 'Documento',
};

export const TIMELINE_TYPE_ICONS = {
  pts: 'pts',
  team_member: 'team',
  activity: 'activity',
  appointment: 'session',
  document: 'file',
} as const satisfies Record<TimelineTargetType, string>;

// GET /pts/:id/timeline: admin, equipe ou o paciente titular.
export function getTimeline(ptsId: string, query: TimelineQuery) {
  const params = new URLSearchParams({
    page: String(query.page),
    limit: String(query.limit),
  });

  if (query.q) {
    params.set('q', query.q);
  }

  if (query.types?.length) {
    params.set('type', query.types.join(','));
  }

  if (query.authorId) {
    params.set('authorId', query.authorId);
  }

  if (query.from) {
    params.set('from', query.from);
  }

  if (query.to) {
    params.set('to', query.to);
  }

  if (query.order === 'asc') {
    params.set('order', 'asc');
  }

  return request<TimelineResponse>(
    `/pts/${encodeURIComponent(ptsId)}/timeline?${params.toString()}`,
    { signal: query.signal },
  );
}

// O app atende o SUS do Paraná: a hora e o dia dos eventos seguem o horário
// de Brasília, igual em qualquer máquina.
export const TIMELINE_TIME_ZONE = 'America/Sao_Paulo';

/** Dia do evento em `dd/mm/aaaa`, no horário de Brasília. */
export function formatTimelineDay(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: TIMELINE_TIME_ZONE,
  });
}

/** Hora do evento em `hh:mm`, no horário de Brasília. */
export function formatTimelineTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    timeZone: TIMELINE_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Agrupa os eventos (já do mais recente ao mais antigo) por dia. */
export function groupTimelineByDay(records: TimelineRecord[]) {
  const groups: { day: string; records: TimelineRecord[] }[] = [];

  for (const record of records) {
    const day = formatTimelineDay(record.happenedAt);
    const current = groups[groups.length - 1];

    if (current?.day === day) {
      current.records.push(record);
    } else {
      groups.push({ day, records: [record] });
    }
  }

  return groups;
}

const GOAL_EVENTS = new Set(['goal_added', 'goal_updated', 'goal_removed']);

export type TimelineLink = { label: string; href: string };

/**
 * Link do evento: atendimento, atividade, meta ou documento. Eventos da ficha
 * e da equipe não têm link; sem `targetId` (documento para o paciente,
 * RN028) também não.
 */
export function timelineLink(
  record: TimelineRecord,
  patientId: string,
): TimelineLink | null {
  if (!record.targetId) {
    return null;
  }

  switch (record.targetType) {
    case 'appointment':
      return { label: 'Ver atendimento', href: '#atendimentos' };
    case 'activity':
      return { label: 'Ver atividade', href: '#atividades' };
    case 'document':
      return {
        label: 'Ver documento',
        href: `/patients/${encodeURIComponent(patientId)}#documentos`,
      };
    case 'pts':
      return GOAL_EVENTS.has(record.type)
        ? { label: 'Ver meta', href: '#metas' }
        : null;
    default:
      return null;
  }
}
