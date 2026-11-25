import { Injectable } from '@nestjs/common';

import type { AccountContext } from '../../accounts/services/accounts.service';
import { isAdmin } from '../../auth/account-context';
import { assertPtsEditable } from '../../pts/goal-rules';
import {
  assertCanViewPts,
  ownTeamProfile,
  teamIds,
} from '../../pts/pts-access';
import { ptsNotFound } from '../../pts/pts.errors';
import {
  PtsGoalsRepository,
  type GoalPtsTarget,
} from '../../pts/repositories/pts-goals.repository';
import {
  activityForbidden,
  executorsNotAllowed,
  invalidActivityAuthor,
  invalidActivityDocuments,
  invalidActivityExecutors,
  invalidActivityGoal,
  invalidFrequency,
} from '../activities.errors';
import type {
  ActivityResponseDto,
  GetActivitiesResponseDto,
} from '../dto/activity-response.dto';
import type {
  ActivityFrequencyDto,
  CreateActivityRequestDto,
} from '../dto/create-activity.dto';
import {
  ActivityExecutor,
  ActivityModality,
  ActivityPeriod,
} from '../enums/activity.enums';
import { ActivitiesRepository } from '../repositories/activities.repository';

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function parseFrequency(value: unknown): ActivityFrequencyDto {
  const { quantity, period, durationMinutes } = (value ??
    {}) as Partial<ActivityFrequencyDto>;

  if (
    !isPositiveInteger(quantity) ||
    !isPositiveInteger(durationMinutes) ||
    !Object.values(ActivityPeriod).includes(period as ActivityPeriod)
  ) {
    throw invalidFrequency();
  }

  return { quantity, period: period as ActivityPeriod, durationMinutes };
}

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly activitiesRepository: ActivitiesRepository,
    private readonly goalsRepository: PtsGoalsRepository,
  ) {}

  async findActivities(
    ptsId: string,
    account: AccountContext,
  ): Promise<GetActivitiesResponseDto> {
    const pts = await this.findPts(ptsId);

    assertCanViewPts(pts, account);

    const activities = await this.activitiesRepository.findByPts(ptsId);
    const seesDocuments =
      isAdmin(account) || ownTeamProfile(pts, account) !== undefined;

    return {
      data: seesDocuments
        ? activities
        : activities.map((activity) => ({ ...activity, documentIds: [] })),
    };
  }

  async createActivity(
    ptsId: string,
    dto: CreateActivityRequestDto,
    account: AccountContext,
  ): Promise<ActivityResponseDto> {
    const pts = await this.findPts(ptsId);
    const admin = isAdmin(account);
    const profileId = ownTeamProfile(pts, account) ?? null;

    if (!admin && !profileId) {
      throw activityForbidden();
    }

    assertPtsEditable(pts.status);

    const frequency = parseFrequency(dto.frequency);
    const executor = dto.executor ?? ActivityExecutor.Team;
    const executorProfessionalIds = [
      ...new Set(dto.executorProfessionalIds ?? []),
    ];
    const documentIds = [...new Set(dto.documentIds ?? [])];

    await this.assertLinks(pts, dto, executor, executorProfessionalIds);
    await this.assertDocuments(pts, documentIds);

    if (
      admin &&
      dto.authorProfessionalId &&
      !teamIds(pts).includes(dto.authorProfessionalId)
    ) {
      throw invalidActivityAuthor();
    }

    const executorName =
      (await this.goalsRepository.findAccountDisplayName(account.accountId)) ??
      (admin ? 'Administrador' : 'Profissional da equipe');

    return this.activitiesRepository.create({
      ptsId,
      values: {
        title: dto.title,
        description: dto.description,
        type: dto.type,
        specialism: dto.specialism,
        frequency,
        modality: dto.modality,
        visitPlace:
          dto.modality === ActivityModality.ExternalVisit
            ? (dto.visitPlace ?? null)
            : null,
        executor,
        goalId: dto.goalId ?? null,
      },
      executorProfessionalIds,
      documentIds,
      authorProfessionalId: admin
        ? (dto.authorProfessionalId ?? null)
        : profileId,
      executedByAccountId: account.accountId,
      description: `${executorName} sugeriu a atividade ${dto.title}`,
    });
  }

  private async findPts(ptsId: string): Promise<GoalPtsTarget> {
    const pts = await this.goalsRepository.findPtsTarget(ptsId);

    if (!pts) {
      throw ptsNotFound();
    }

    return pts;
  }

  private async assertLinks(
    pts: GoalPtsTarget,
    dto: CreateActivityRequestDto,
    executor: ActivityExecutor,
    executorProfessionalIds: string[],
  ): Promise<void> {
    if (
      executor !== ActivityExecutor.Team &&
      executorProfessionalIds.length > 0
    ) {
      throw executorsNotAllowed();
    }

    if (executorProfessionalIds.some((id) => !teamIds(pts).includes(id))) {
      throw invalidActivityExecutors();
    }

    if (dto.goalId) {
      const goals = await this.goalsRepository.findByPts(pts.id);

      if (!goals.some((goal) => goal.id === dto.goalId)) {
        throw invalidActivityGoal();
      }
    }
  }

  private async assertDocuments(
    pts: GoalPtsTarget,
    documentIds: string[],
  ): Promise<void> {
    if (documentIds.length === 0) {
      return;
    }

    const found = await this.activitiesRepository.findPatientDocumentIds(
      pts.patientId,
      documentIds,
    );

    if (found.length !== documentIds.length) {
      throw invalidActivityDocuments();
    }
  }
}
