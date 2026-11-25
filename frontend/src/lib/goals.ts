import { request } from '@/lib/api';

export type GoalTerm = 'short' | 'medium' | 'long';
export type GoalArea =
  'communication' | 'social' | 'cognitive' | 'motor_sensory';
export type GoalStatus =
  'in_progress' | 'achieved' | 'partially_achieved' | 'not_achieved';
export type GoalOrigin = 'new' | 'kept_partial' | 'kept_not_achieved';

export type Goal = {
  id: string;
  title: string;
  description: string;
  // Em branco na meta copiada para a nova versão (RFPTS013).
  term: GoalTerm | null;
  area: GoalArea;
  measureCriterion: string;
  targetDate: string | null;
  status: GoalStatus;
  resultNote: string | null;
  origin: GoalOrigin;
  activitiesCount: number;
  registeredBy: { id: string; name: string };
  createdAt: string;
};

export type GoalInput = {
  title: string;
  description: string;
  term: GoalTerm;
  area: GoalArea;
  measureCriterion: string;
  targetDate: string;
};

export const GOAL_TERM_LABELS: Record<GoalTerm, string> = {
  short: 'Curto prazo (até 3 meses)',
  medium: 'Médio prazo (até 6 meses)',
  long: 'Longo prazo',
};

export const GOAL_AREA_LABELS: Record<GoalArea, string> = {
  communication: 'Comunicação',
  social: 'Social',
  cognitive: 'Cognitivo',
  motor_sensory: 'Motor/Sensorial',
};

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  in_progress: 'Em andamento',
  achieved: 'Atingida',
  partially_achieved: 'Parcialmente atingida',
  not_achieved: 'Não atingida',
};

export const GOAL_STATUS_BADGES: Record<GoalStatus, string> = {
  in_progress: 'running',
  achieved: 'done',
  partially_achieved: 'partial',
  not_achieved: 'not-met',
};

export const GOAL_ORIGIN_LABELS: Record<GoalOrigin, string> = {
  new: 'Nova',
  kept_partial: 'Versão anterior · parcial',
  kept_not_achieved: 'Versão anterior · não atingida',
};

function goalsPath(ptsId: string, goalId?: string) {
  const path = `/pts/${encodeURIComponent(ptsId)}/goals`;

  return goalId ? `${path}/${encodeURIComponent(goalId)}` : path;
}

export function getGoals(ptsId: string, signal?: AbortSignal) {
  return request<{ data: Goal[] }>(goalsPath(ptsId), { signal });
}

export function createGoal(
  ptsId: string,
  goal: GoalInput & { authorProfessionalId?: string },
) {
  return request<Goal>(goalsPath(ptsId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(goal),
  });
}

export function updateGoal(ptsId: string, goalId: string, goal: GoalInput) {
  return request<Goal>(goalsPath(ptsId, goalId), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(goal),
  });
}

export function deleteGoal(ptsId: string, goalId: string) {
  return request<{ status: 'OK' }>(goalsPath(ptsId, goalId), {
    method: 'DELETE',
  });
}
