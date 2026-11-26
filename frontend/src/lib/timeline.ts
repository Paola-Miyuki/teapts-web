import { request } from '@/lib/api';
import { formatDate, TIME_ZONE } from '@/lib/format';

export type TimelineTargetType =
  'pts' | 'activity' | 'appointment' | 'team_member' | 'document';

export type TimelinePerson = { id: string; name: string };

export type TimelineOrder = 'asc' | 'desc';

export type TimelineRecord = {
  id: string;
  type: string;
  targetType: TimelineTargetType;
  targetId: string | null;
  description: string;
  happenedAt: string;
  author: TimelinePerson;
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

export function formatTimelineTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function groupTimelineByDay(records: TimelineRecord[]) {
  const groups: { day: string; records: TimelineRecord[] }[] = [];

  for (const record of records) {
    const day = formatDate(record.happenedAt);
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

// Sem targetId (documento para o paciente, RN028) não há link.
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
