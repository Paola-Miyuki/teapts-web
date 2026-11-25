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
  activitiesViewForbidden,
  activityArchiveForbidden,
  activityEditForbidden,
  activityForbidden,
  activityNotFound,
  activityStatusForbidden,
  executorsNotAllowed,
  invalidActivityAuthor,
  invalidActivityDocuments,
  invalidActivityExecutors,
  invalidActivityGoal,
  invalidFrequency,
  missingVisitPlace,
} from '../activities.errors';
import {
  assertActivityArchivable,
  assertActivityEditable,
  assertActivityTransition,
  editableStates,
  type ActivityStatusAction,
} from '../activity-rules';
import type {
  ActivityDetailsResponseDto,
  ActivityResponseDto,
  GetActivitiesResponseDto,
} from '../dto/activity-response.dto';
import type { GetActivitiesQueryDto } from '../dto/get-activities-query.dto';
import type {
  ActivityStatusResponseDto,
  SuspendActivityRequestDto,
} from '../dto/activity-status.dto';
import type {
  ArchiveActivityRequestDto,
  ArchiveActivityResponseDto,
} from '../dto/archive-activity.dto';
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
import { toPagination } from '../../common/pagination/pagination';

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

const STATUS_VERBS: Record<ActivityStatusAction, string> = {
  suspend: 'suspendeu',
  resume: 'retomou',
  conclude: 'concluiu',
};

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly activitiesRepository: ActivitiesRepository,
    private readonly goalsRepository: PtsGoalsRepository,
  ) {}

  async findActivities(
    ptsId: string,
    query: GetActivitiesQueryDto,
    account: AccountContext,
  ): Promise<GetActivitiesResponseDto> {
    const pts = await this.findPts(ptsId);

    assertCanViewPts(pts, account, activitiesViewForbidden);

    const { rows, total } = await this.activitiesRepository.findByPts({
      ptsId,
      ...query,
    });
    const seesDocuments =
      isAdmin(account) || ownTeamProfile(pts, account) !== undefined;

    return {
      data: seesDocuments
        ? rows
        : rows.map((activity) => ({ ...activity, documentIds: [] })),
      pagination: toPagination(query, total),
    };
  }

  async findActivityById(
    activityId: string,
    account: AccountContext,
  ): Promise<ActivityDetailsResponseDto> {
    const activity = await this.activitiesRepository.findById(activityId);

    if (!activity) {
      throw activityNotFound();
    }

    const pts = await this.findPts(activity.ptsId);

    assertCanViewPts(pts, account, activitiesViewForbidden);

    const details = await this.activitiesRepository.findDetailsById(activityId);

    if (!details) {
      throw activityNotFound();
    }

    const seesDocuments =
      isAdmin(account) || ownTeamProfile(pts, account) !== undefined;

    if (seesDocuments) {
      return details;
    }

    return { ...details, documentIds: [], documents: [] };
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

  async archiveActivity(
    activityId: string,
    dto: ArchiveActivityRequestDto,
    account: AccountContext,
  ): Promise<ArchiveActivityResponseDto> {
    const activity = await this.activitiesRepository.findById(activityId);

    if (!activity) {
      throw activityNotFound();
    }

    const pts = await this.findPts(activity.ptsId);
    const admin = isAdmin(account);
    // Qualquer profissional da equipe do PTS ou o admin (RFACT008).
    const profileId = admin ? null : (ownTeamProfile(pts, account) ?? null);

    if (!admin && !profileId) {
      throw activityArchiveForbidden();
    }

    assertActivityArchivable(activity.status);
    assertPtsEditable(pts.status);

    const reason = dto.reason?.trim() || null;
    const executorName = await this.executorName(account, admin);

    return this.activitiesRepository.archive({
      ptsId: pts.id,
      activityId,
      reason,
      // Admin não tem perfil profissional: sem autor no evento (RN029).
      authorProfessionalId: profileId,
      executedByAccountId: account.accountId,
      description: `${executorName} arquivou a atividade ${activity.title}${
        reason ? ` (${reason})` : ''
      }`,
    });
  }

  async changeActivityStatus(
    activityId: string,
    action: ActivityStatusAction,
    dto: SuspendActivityRequestDto,
    account: AccountContext,
  ): Promise<ActivityStatusResponseDto> {
    const activity = await this.activitiesRepository.findById(activityId);

    if (!activity) {
      throw activityNotFound();
    }

    const pts = await this.findPts(activity.ptsId);
    const admin = isAdmin(account);
    // Qualquer profissional da equipe do PTS ou o admin (RFACT009).
    const profileId = admin ? null : (ownTeamProfile(pts, account) ?? null);

    if (!admin && !profileId) {
      throw activityStatusForbidden();
    }

    assertActivityTransition(action, activity.status);
    assertPtsEditable(pts.status);

    const reason = dto.reason?.trim() || null;
    const executorName = await this.executorName(account, admin);

    return this.activitiesRepository.changeStatus({
      ptsId: pts.id,
      activityId,
      action,
      reason,
      // Admin não tem perfil profissional: sem autor no evento (RN029).
      authorProfessionalId: profileId,
      executedByAccountId: account.accountId,
      description: `${executorName} ${STATUS_VERBS[action]} a atividade ${activity.title}${
        reason ? ` (${reason})` : ''
      }`,
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
