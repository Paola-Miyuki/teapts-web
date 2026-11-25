import { Injectable } from '@nestjs/common';

import type { AccountContext } from '../../accounts/services/accounts.service';
import { isAdmin } from '../../auth/account-context';
import { assertPtsEditable } from '../../pts/goal-rules';
import {
  assertCanViewPts,
  ownTeamProfile,
  teamIds,
} from '../../pts/pts-access';
import { ptsNotFound, validationError } from '../../pts/pts.errors';
import {
  PtsGoalsRepository,
  type GoalPtsTarget,
} from '../../pts/repositories/pts-goals.repository';
import {
  activityEditForbidden,
  activityForbidden,
  activityNotFound,
  executorsNotAllowed,
  invalidActivityAuthor,
  invalidActivityDocuments,
  invalidActivityExecutors,
  invalidActivityGoal,
  invalidFrequency,
  missingVisitPlace,
} from '../activities.errors';
import { assertActivityEditable, editableStates } from '../activity-rules';
import type {
  ActivityResponseDto,
  GetActivitiesResponseDto,
} from '../dto/activity-response.dto';
import type {
  ActivityFrequencyDto,
  CreateActivityRequestDto,
} from '../dto/create-activity.dto';
import type { UpdateActivityRequestDto } from '../dto/update-activity.dto';
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

    const executorName = await this.executorName(account, admin);

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

  async updateActivity(
    activityId: string,
    dto: UpdateActivityRequestDto,
    account: AccountContext,
  ): Promise<ActivityResponseDto> {
    const activity = await this.activitiesRepository.findById(activityId);

    if (!activity) {
      throw activityNotFound();
    }

    const pts = await this.findPts(activity.ptsId);
    const admin = isAdmin(account);
    // Perfil da conta na equipe do PTS: quem sai da equipe perde a edição.
    const isOwnTeamProfile = (id: string | null) =>
      id !== null &&
      teamIds(pts).includes(id) &&
      account.professionalProfileIds.includes(id);
    const allowedStates = editableStates({
      admin,
      author: isOwnTeamProfile(activity.authorProfessionalId),
      responsible: isOwnTeamProfile(pts.responsibleProfessionalId),
    });

    if (allowedStates.length === 0) {
      throw activityEditForbidden();
    }

    assertActivityEditable(activity.status, allowedStates);
    assertPtsEditable(pts.status);

    const changes = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    ) as UpdateActivityRequestDto;

    if (Object.keys(changes).length === 0) {
      throw validationError([
        { field: 'body', message: 'Informe ao menos um campo da atividade.' },
      ]);
    }

    const frequency =
      changes.frequency === undefined
        ? activity.frequency
        : parseFrequency(changes.frequency);
    const modality = changes.modality ?? activity.modality;
    const visitPlace =
      modality === ActivityModality.ExternalVisit
        ? (changes.visitPlace ?? activity.visitPlace)
        : null;

    if (modality === ActivityModality.ExternalVisit && !visitPlace) {
      throw missingVisitPlace();
    }

    const goalId =
      changes.goalId === undefined ? activity.goalId : changes.goalId;

    if (goalId && goalId !== activity.goalId) {
      await this.assertGoal(pts, goalId);
    }

    const documentIds =
      changes.documentIds === undefined
        ? undefined
        : [...new Set(changes.documentIds ?? [])];

    if (documentIds) {
      await this.assertDocuments(pts, documentIds);
    }

    const title = changes.title ?? activity.title;
    const executorName = await this.executorName(account, admin);

    return this.activitiesRepository.update({
      ptsId: pts.id,
      activityId,
      values: {
        title,
        description: changes.description ?? activity.description,
        type: changes.type ?? activity.type,
        frequency,
        modality,
        visitPlace,
        goalId,
      },
      documentIds,
      allowedStates,
      // Admin não tem perfil profissional: sem autor no evento (RN029).
      authorProfessionalId: admin
        ? null
        : (ownTeamProfile(pts, account) ?? null),
      executedByAccountId: account.accountId,
      description: `${executorName} atualizou a atividade ${title}`,
      goalUnlinkedDescription: `${executorName} desligou a atividade ${title} da meta`,
    });
  }

  private async executorName(
    account: AccountContext,
    admin: boolean,
  ): Promise<string> {
    return (
      (await this.goalsRepository.findAccountDisplayName(account.accountId)) ??
      (admin ? 'Administrador' : 'Profissional da equipe')
    );
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
      await this.assertGoal(pts, dto.goalId);
    }
  }

  private async assertGoal(pts: GoalPtsTarget, goalId: string): Promise<void> {
    const goals = await this.goalsRepository.findByPts(pts.id);

    if (!goals.some((goal) => goal.id === goalId)) {
      throw invalidActivityGoal();
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
