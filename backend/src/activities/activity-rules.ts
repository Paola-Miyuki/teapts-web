import {
  activityEditForbidden,
  activityNotArchivable,
  activityNotEditable,
  activityNotSuggested,
  invalidActivityTransition,
} from './activities.errors';
import { ActivityState } from './enums/activity.enums';

const LOCKED_STATES = [ActivityState.Rejected, ActivityState.Archived];

// Arquiva só o que ainda faz parte do plano (RFACT008).
const ARCHIVABLE_STATES = [
  ActivityState.Suggested,
  ActivityState.Running,
  ActivityState.Suspended,
];

/** Suspender, retomar e concluir (RFACT009); a concluída não volta. */
export const ACTIVITY_TRANSITIONS = {
  suspend: {
    from: [ActivityState.Running],
    to: ActivityState.Suspended,
  },
  resume: {
    from: [ActivityState.Suspended],
    to: ActivityState.Running,
  },
  conclude: {
    from: [ActivityState.Running, ActivityState.Suspended],
    to: ActivityState.Concluded,
  },
} as const;

export type ActivityStatusAction = keyof typeof ACTIVITY_TRANSITIONS;

export function assertActivityTransition(
  action: ActivityStatusAction,
  status: ActivityState,
): void {
  const from: readonly ActivityState[] = ACTIVITY_TRANSITIONS[action].from;

  if (!from.includes(status)) {
    throw invalidActivityTransition();
  }
}

export interface ActivityEditor {
  admin: boolean;
  author: boolean;
  responsible: boolean;
}

/**
 * Estados que cada um edita (RFACT005): o autor, a sugerida; o responsável do
 * PTS, a sugerida ou em andamento; o admin, todas menos as travadas (RN022).
 */
export function editableStates({
  admin,
  author,
  responsible,
}: ActivityEditor): ActivityState[] {
  if (admin) {
    return Object.values(ActivityState).filter(
      (state) => !LOCKED_STATES.includes(state),
    );
  }

  return [
    ...(author || responsible ? [ActivityState.Suggested] : []),
    ...(responsible ? [ActivityState.Running] : []),
  ];
}

/** Rejeitada ou arquivada não muda (409); fora do que a pessoa edita, 403. */
export function assertActivityEditable(
  status: ActivityState,
  allowedStates: ActivityState[],
): void {
  if (LOCKED_STATES.includes(status)) {
    throw activityNotEditable();
  }

  if (!allowedStates.includes(status)) {
    throw activityEditForbidden();
  }
}

/** Rejeitada, concluída ou já arquivada não é arquivada (409). */
export function assertActivityArchivable(status: ActivityState): void {
  if (!ARCHIVABLE_STATES.includes(status)) {
    throw activityNotArchivable();
  }
}

/** Aprovar ou rejeitar a sugerida (RFACT003): aprovada já entra em execução. */
export const ACTIVITY_DECISIONS = {
  approve: ActivityState.Running,
  reject: ActivityState.Rejected,
} as const;

export type ActivityDecision = keyof typeof ACTIVITY_DECISIONS;

/** Só a sugerida recebe decisão (409). */
export function assertActivitySuggested(status: ActivityState): void {
  if (status !== ActivityState.Suggested) {
    throw activityNotSuggested();
  }
}
