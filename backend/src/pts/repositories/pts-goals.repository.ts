import type { PtsStateEnum } from '../../database/enums/pts-state.enum';
import type { CreateGoalRequestDto } from '../dto/create-goal.dto';
import type { GoalResponseDto } from '../dto/goal-response.dto';
import type { UpdateGoalRequestDto } from '../dto/update-goal.dto';

export interface GoalPtsTarget {
  id: string;
  status: PtsStateEnum;
  patientId: string;
  responsibleProfessionalId: string;
  teamProfessionalIds: string[];
  nextReviewAt: string;
}

/** Autoria (RN029) e texto do evento gravado na timeline. */
interface GoalEventInput {
  authorProfessionalId: string | null;
  executedByAccountId: string;
  description: string;
}

export interface CreateGoalInput extends GoalEventInput {
  ptsId: string;
  values: Omit<CreateGoalRequestDto, 'authorProfessionalId'>;
}

export interface UpdateGoalInput extends GoalEventInput {
  ptsId: string;
  goalId: string;
  changes: UpdateGoalRequestDto;
}

export interface RemoveGoalInput extends GoalEventInput {
  ptsId: string;
  goalId: string;
}

export abstract class PtsGoalsRepository {
  abstract findPtsTarget(ptsId: string): Promise<GoalPtsTarget | null>;
  abstract findAccountDisplayName(accountId: string): Promise<string | null>;
  abstract findByPts(ptsId: string): Promise<GoalResponseDto[]>;
  abstract create(input: CreateGoalInput): Promise<GoalResponseDto>;
  abstract update(input: UpdateGoalInput): Promise<GoalResponseDto>;
  abstract remove(input: RemoveGoalInput): Promise<void>;
}
