import {
  activityEditForbidden,
  activityNotEditable,
} from './activities.errors';
import { ActivityState } from './enums/activity.enums';

const LOCKED_STATES = [ActivityState.Rejected, ActivityState.Archived];

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
