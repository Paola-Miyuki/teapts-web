import { GoalStatus } from './enums/goal.enums';
import {
  goalsWithoutResult,
  reassessmentGoalsInvalid,
} from './reassessment.errors';

/**
 * Cada meta avaliada é deste PTS e aparece uma vez só; nenhuma meta em
 * andamento fica sem resultado (RFEVA005).
 */
export function assertGoalsAssessed(
  goals: { id: string; status: GoalStatus }[],
  results: { goalId: string }[],
): void {
  const ptsGoalIds = new Set(goals.map(({ id }) => id));
  const assessed = new Set(results.map(({ goalId }) => goalId));

  if (
    assessed.size !== results.length ||
    results.some(({ goalId }) => !ptsGoalIds.has(goalId))
  ) {
    throw reassessmentGoalsInvalid();
  }

  const missing = goals.filter(
    (goal) => goal.status === GoalStatus.InProgress && !assessed.has(goal.id),
  ).length;

  if (missing > 0) {
    throw goalsWithoutResult(missing);
  }
}
