import { PtsStateEnum } from '../database/enums/pts-state.enum';
import {
  goalHasActivities,
  lastGoal,
  ptsNotEditable,
  validationError,
} from './pts.errors';

const EDITABLE_STATES = [
  PtsStateEnum.DRAFT,
  PtsStateEnum.PLANNING,
  PtsStateEnum.RUNNING,
];

export function assertPtsEditable(status: PtsStateEnum): void {
  if (!EDITABLE_STATES.includes(status)) {
    throw ptsNotEditable();
  }
}

/** A data-alvo não passa da próxima revisão (RN031); datas em yyyy-mm-dd. */
export function assertTargetDate(
  targetDate: string | undefined,
  nextReviewAt: string,
): void {
  if (targetDate !== undefined && targetDate > nextReviewAt) {
    throw validationError([
      {
        field: 'targetDate',
        message: 'A data-alvo não pode passar da próxima revisão do PTS.',
      },
    ]);
  }
}

export function assertGoalRemovable(
  goalsCount: number,
  activitiesCount: number,
): void {
  if (goalsCount <= 1) {
    throw lastGoal();
  }

  if (activitiesCount > 0) {
    throw goalHasActivities();
  }
}
