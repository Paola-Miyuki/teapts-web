import { Injectable } from '@nestjs/common';

import type { AccountContext } from '../../accounts/services/accounts.service';
import { isAdmin } from '../../auth/account-context';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import type { CreateGoalRequestDto } from '../dto/create-goal.dto';
import type {
  DeleteGoalResponseDto,
  GetGoalsResponseDto,
  GoalResponseDto,
} from '../dto/goal-response.dto';
import type { UpdateGoalRequestDto } from '../dto/update-goal.dto';
import {
  assertGoalRemovable,
  assertGoalsEditable,
  assertTargetDate,
} from '../goal-rules';
import {
  goalForbidden,
  goalNotFound,
  ptsForbidden,
  ptsNotFound,
  validationError,
} from '../pts.errors';
import {
  PtsGoalsRepository,
  type GoalPtsTarget,
} from '../repositories/pts-goals.repository';

function teamIds(pts: GoalPtsTarget): string[] {
  return [pts.responsibleProfessionalId, ...pts.teamProfessionalIds];
}

function ownTeamProfile(
  pts: GoalPtsTarget,
  account: AccountContext,
): string | undefined {
  return teamIds(pts).find((id) => account.professionalProfileIds.includes(id));
}

@Injectable()
export class PtsGoalsService {
  constructor(private readonly goalsRepository: PtsGoalsRepository) {}

  async findGoals(
    ptsId: string,
    account: AccountContext,
  ): Promise<GetGoalsResponseDto> {
    const pts = await this.findPts(ptsId);
    const isPatientOwner =
      account.patientProfileId !== null &&
      account.patientProfileId === pts.patientId;
    // A equipe não abre PTS rejeitado (RN016).
    const isTeam =
      pts.status !== PtsStateEnum.REJECTED &&
      ownTeamProfile(pts, account) !== undefined;

    if (!isAdmin(account) && !isPatientOwner && !isTeam) {
      throw ptsForbidden();
    }

    return { data: await this.goalsRepository.findByPts(ptsId) };
  }

  async createGoal(
    ptsId: string,
    dto: CreateGoalRequestDto,
    account: AccountContext,
  ): Promise<GoalResponseDto> {
    const { pts, profileId, executorName } = await this.findEditablePts(
      ptsId,
      account,
    );
    const { authorProfessionalId, ...values } = dto;

    if (
      isAdmin(account) &&
      authorProfessionalId &&
      !teamIds(pts).includes(authorProfessionalId)
    ) {
      throw validationError([
        {
          field: 'authorProfessionalId',
          message: 'O autor da meta precisa ser da equipe do PTS.',
        },
      ]);
    }

    assertTargetDate(values.targetDate, pts.nextReviewAt);

    return this.goalsRepository.create({
      ptsId,
      values,
      authorProfessionalId: isAdmin(account)
        ? (authorProfessionalId ?? null)
        : profileId,
      executedByAccountId: account.accountId,
      description: `${executorName} adicionou a meta ${values.title}`,
    });
  }

  async updateGoal(
    ptsId: string,
    goalId: string,
    dto: UpdateGoalRequestDto,
    account: AccountContext,
  ): Promise<GoalResponseDto> {
    const { pts, profileId, executorName } = await this.findEditablePts(
      ptsId,
      account,
    );
    const { goal } = await this.findGoal(ptsId, goalId);
    const changes = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    ) as UpdateGoalRequestDto;

    if (Object.keys(changes).length === 0) {
      throw validationError([
        { field: 'body', message: 'Informe ao menos um campo da meta.' },
      ]);
    }

    assertTargetDate(changes.targetDate, pts.nextReviewAt);

    return this.goalsRepository.update({
      ptsId,
      goalId,
      changes,
      authorProfessionalId: profileId,
      executedByAccountId: account.accountId,
      description: `${executorName} atualizou a meta ${changes.title ?? goal.title}`,
    });
  }

  async removeGoal(
    ptsId: string,
    goalId: string,
    account: AccountContext,
  ): Promise<DeleteGoalResponseDto> {
    const { profileId, executorName } = await this.findEditablePts(
      ptsId,
      account,
    );
    const { goal, total } = await this.findGoal(ptsId, goalId);

    assertGoalRemovable(total, goal.activitiesCount);

    await this.goalsRepository.remove({
      ptsId,
      goalId,
      authorProfessionalId: profileId,
      executedByAccountId: account.accountId,
      description: `${executorName} excluiu a meta ${goal.title}`,
    });

    return { status: 'OK' };
  }

  private async findPts(ptsId: string): Promise<GoalPtsTarget> {
    const pts = await this.goalsRepository.findPtsTarget(ptsId);

    if (!pts) {
      throw ptsNotFound();
    }

    return pts;
  }

  private async findEditablePts(ptsId: string, account: AccountContext) {
    const pts = await this.findPts(ptsId);
    const admin = isAdmin(account);
    // Admin não tem perfil profissional: sem autor no evento (RN029).
    const profileId = admin ? null : (ownTeamProfile(pts, account) ?? null);

    if (!admin && !profileId) {
      throw goalForbidden();
    }

    assertGoalsEditable(pts.status);

    const executorName =
      (await this.goalsRepository.findAccountDisplayName(account.accountId)) ??
      (admin ? 'Administrador' : 'Profissional da equipe');

    return { pts, profileId, executorName };
  }

  private async findGoal(ptsId: string, goalId: string) {
    const goals = await this.goalsRepository.findByPts(ptsId);
    const goal = goals.find((item) => item.id === goalId);

    if (!goal) {
      throw goalNotFound();
    }

    return { goal, total: goals.length };
  }
}
