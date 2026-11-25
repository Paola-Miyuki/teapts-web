import { request } from '@/lib/api';

export const ACTIVITY_TYPE_LABELS = {
  individual_session: 'Sessão terapêutica individual',
  group_session: 'Sessão terapêutica em grupo',
  parental_guidance: 'Orientação parental',
  school_support: 'Apoio matricial ou visita escolar',
  team_meeting: 'Estudo de caso ou reunião de equipe',
  home_activity: 'Atividade domiciliar',
  consultation: 'Consulta',
  referral: 'Encaminhamento',
  other: 'Outro',
} as const;

export const ACTIVITY_PERIOD_LABELS = {
  weekly: 'por semana',
  biweekly: 'quinzenal',
  monthly: 'por mês',
  on_demand: 'sob demanda',
} as const;

export const ACTIVITY_MODALITY_LABELS = {
  in_person: 'Presencial',
  telehealth: 'Teleatendimento',
  external_visit: 'Visita externa',
} as const;

export const VISIT_PLACE_LABELS = {
  home: 'Domicílio',
  school: 'Escola',
  other: 'Outro',
} as const;

export const ACTIVITY_EXECUTOR_LABELS = {
  team: 'Equipe',
  family: 'Família',
  school: 'Escola',
} as const;

export const ACTIVITY_STATUS_LABELS = {
  suggested: 'Sugerida',
  running: 'Em andamento',
  suspended: 'Suspensa',
  concluded: 'Concluída',
  rejected: 'Rejeitada',
  archived: 'Arquivada',
} as const;

export type ActivityType = keyof typeof ACTIVITY_TYPE_LABELS;
export type ActivityPeriod = keyof typeof ACTIVITY_PERIOD_LABELS;
export type ActivityModality = keyof typeof ACTIVITY_MODALITY_LABELS;
export type VisitPlace = keyof typeof VISIT_PLACE_LABELS;
export type ActivityExecutor = keyof typeof ACTIVITY_EXECUTOR_LABELS;
export type ActivityStatus = keyof typeof ACTIVITY_STATUS_LABELS;

export type ActivityFrequency = {
  quantity: number;
  period: ActivityPeriod;
  durationMinutes: number;
};

export type Activity = {
  id: string;
  title: string;
  description: string;
  type: ActivityType;
  specialism: string;
  frequency: ActivityFrequency;
  modality: ActivityModality;
  visitPlace: VisitPlace | null;
  executor: ActivityExecutor;
  executorProfessionalIds: string[];
  goalId: string | null;
  documentIds: string[];
  status: ActivityStatus;
  authorProfessionalId: string | null;
  createdAt: string;
  updatedAt: string | null;
};

export type ActivityPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ActivityListQuery = {
  status?: ActivityStatus[];
  executor?: ActivityExecutor;
  page: number;
  limit: number;
};

export type ActivityDetails = Activity & {
  goal: { id: string; title: string } | null;
  documents: { id: string; title: string }[];
  appointmentsCount: number;
};

export type ActivityInput = Pick<
  Activity,
  | 'title'
  | 'description'
  | 'type'
  | 'specialism'
  | 'frequency'
  | 'modality'
  | 'executor'
> & {
  visitPlace?: VisitPlace;
  executorProfessionalIds?: string[];
  goalId?: string;
  authorProfessionalId?: string;
};

// Campos que a edição altera (RFACT005); goalId null desliga a meta.
export type ActivityUpdateInput = Partial<
  Pick<Activity, 'title' | 'description' | 'type' | 'frequency' | 'modality'>
> & {
  visitPlace?: VisitPlace;
  goalId?: string | null;
  documentIds?: string[];
};

/** Ex.: "1x por semana, 45 min". */
export function formatFrequency(frequency: ActivityFrequency) {
  return `${frequency.quantity}x ${ACTIVITY_PERIOD_LABELS[frequency.period]}, ${frequency.durationMinutes} min`;
}

function activitiesPath(ptsId: string) {
  return `/pts/${encodeURIComponent(ptsId)}/activities`;
}

export function getActivities(
  ptsId: string,
  query: ActivityListQuery,
  signal?: AbortSignal,
) {
  const search = new URLSearchParams({
    page: String(query.page),
    limit: String(query.limit),
  });
  query.status?.forEach((status) => search.append('status', status));

  if (query.executor) {
    search.set('executor', query.executor);
  }

  return request<{ data: Activity[]; pagination: ActivityPagination }>(
    `${activitiesPath(ptsId)}?${search.toString()}`,
    { signal },
  );
}

export function getActivity(activityId: string, signal?: AbortSignal) {
  return request<ActivityDetails>(
    `/activities/${encodeURIComponent(activityId)}`,
    { signal },
  );
}

export function createActivity(ptsId: string, activity: ActivityInput) {
  return request<Activity>(activitiesPath(ptsId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(activity),
  });
}

export function updateActivity(
  activityId: string,
  changes: ActivityUpdateInput,
) {
  return request<Activity>(`/activities/${encodeURIComponent(activityId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  });
}
