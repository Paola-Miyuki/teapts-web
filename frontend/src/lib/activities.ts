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

// Filtro padrão da lista: o que ainda faz parte do plano (`pts-detalhe.html`).
// São também os estados que podem ser arquivados (RFACT008).
export const ACTIVE_ACTIVITY_STATUSES: ActivityStatus[] = [
  'suggested',
  'running',
  'suspended',
];

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

export function getActivities(ptsId: string, signal?: AbortSignal) {
  return request<{ data: Activity[] }>(activitiesPath(ptsId), { signal });
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

export type ArchiveActivityResponse = {
  id: string;
  status: 'archived';
  archivedAt: string;
};

export function archiveActivity(activityId: string, reason?: string) {
  return request<ArchiveActivityResponse>(
    `/activities/${encodeURIComponent(activityId)}/archive`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reason ? { reason } : {}),
    },
  );
}

export type ActivityStatusAction = 'suspend' | 'resume' | 'conclude';

export type ActivityStatusResponse = {
  id: string;
  status: 'suspended' | 'running' | 'concluded';
  changedAt: string;
};

// O motivo só vale na suspensão (RFACT009).
export function changeActivityStatus(
  activityId: string,
  action: ActivityStatusAction,
  reason?: string,
) {
  return request<ActivityStatusResponse>(
    `/activities/${encodeURIComponent(activityId)}/${action}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reason ? { reason } : {}),
    },
  );
}
