import type { GoalResponseDto } from '../dto/goal-response.dto';
import { GoalOrigin, GoalStatus } from '../enums/goal.enums';
import {
  PtsGoalsRepository,
  type CreateGoalInput,
  type GoalPtsTarget,
  type RemoveGoalInput,
  type UpdateGoalInput,
} from '../repositories/pts-goals.repository';

type StoredGoal = GoalResponseDto & { ptsId: string; deleted: boolean };

export class InMemoryPtsGoalsRepository extends PtsGoalsRepository {
  pts: GoalPtsTarget[] = [];
  goals: StoredGoal[] = [];
  accountNames = new Map<string, string>();
  created: CreateGoalInput[] = [];
  updated: UpdateGoalInput[] = [];
  removed: RemoveGoalInput[] = [];

  async findPtsTarget(ptsId: string): Promise<GoalPtsTarget | null> {
    return this.pts.find((pts) => pts.id === ptsId) ?? null;
  }

  async findAccountDisplayName(accountId: string): Promise<string | null> {
    return this.accountNames.get(accountId) ?? null;
  }

  async findByPts(ptsId: string): Promise<GoalResponseDto[]> {
    return this.goals
      .filter((goal) => goal.ptsId === ptsId && !goal.deleted)
      .map((goal) => this.toResponse(goal));
  }

  async create(input: CreateGoalInput): Promise<GoalResponseDto> {
    this.created.push(input);
    const goal: StoredGoal = {
      id: `55555555-5555-4555-8555-55555555555${this.goals.length}`,
      ...input.values,
      status: GoalStatus.InProgress,
      resultNote: null,
      origin: GoalOrigin.New,
      activitiesCount: 0,
      registeredBy: { id: input.executedByAccountId, name: 'Conta' },
      createdAt: '2026-11-25T12:00:00.000Z',
      ptsId: input.ptsId,
      deleted: false,
    };
    this.goals.push(goal);

    return this.toResponse(goal);
  }

  async update(input: UpdateGoalInput): Promise<GoalResponseDto> {
    this.updated.push(input);
    const goal = this.goals.find((item) => item.id === input.goalId)!;
    Object.assign(goal, input.changes);

    return this.toResponse(goal);
  }

  async remove(input: RemoveGoalInput): Promise<void> {
    this.removed.push(input);
    this.goals.find((item) => item.id === input.goalId)!.deleted = true;
  }

  private toResponse(goal: StoredGoal): GoalResponseDto {
    const response: Partial<StoredGoal> = { ...goal };
    delete response.ptsId;
    delete response.deleted;

    return response as GoalResponseDto;
  }
}
