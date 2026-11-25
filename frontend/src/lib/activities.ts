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
  createdAt: string;
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
