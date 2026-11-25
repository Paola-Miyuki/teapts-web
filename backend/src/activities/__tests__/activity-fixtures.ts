import { Specialism } from '../../professionals/enums/specialism.enum';
import type { ActivityResponseDto } from '../dto/activity-response.dto';
import type { CreateActivityRequestDto } from '../dto/create-activity.dto';
import type { FindActivitiesInput } from '../repositories/activities.repository';
import {
  ActivityExecutor,
  ActivityModality,
  ActivityPeriod,
  ActivityState,
  ActivityType,
} from '../enums/activity.enums';
import type { ActivityStatusResponseDto } from '../dto/activity-status.dto';
import type { ArchiveActivityResponseDto } from '../dto/archive-activity.dto';
import { ACTIVITY_TRANSITIONS } from '../activity-rules';
import {
  ActivitiesRepository,
  type ArchiveActivityInput,
  type ChangeActivityStatusInput,
  type CreateActivityInput,
  type StoredActivity,
  type UpdateActivityInput,
} from '../repositories/activities.repository';

export const activityBody = (): CreateActivityRequestDto => ({
  title: 'Integração sensorial',
  description: 'Circuito sensorial com estímulo tátil e vestibular.',
  type: ActivityType.IndividualSession,
  specialism: Specialism.OccupationalTherapist,
  frequency: {
    quantity: 1,
    period: ActivityPeriod.Weekly,
    durationMinutes: 45,
  },
  modality: ActivityModality.InPerson,
});

/** Atividade já gravada: sugerida pelo prof-2 (membro) no pts-1. */
export const storedActivity = (
  overrides: Partial<StoredActivity> = {},
): StoredActivity => ({
  ...activityBody(),
  id: 'act-1',
  ptsId: 'pts-1',
  visitPlace: null,
  executor: ActivityExecutor.Team,
  executorProfessionalIds: [],
  goalId: null,
  documentIds: [],
  status: ActivityState.Suggested,
  authorProfessionalId: 'prof-2',
  createdAt: '2026-12-01T13:00:00.000Z',
  updatedAt: null,
  ...overrides,
});

function toResponse(activity: StoredActivity): ActivityResponseDto {
  const response: Partial<StoredActivity> = { ...activity };
  delete response.ptsId;

  return response as ActivityResponseDto;
}

export class InMemoryActivitiesRepository extends ActivitiesRepository {
  created: CreateActivityInput[] = [];
  updated: UpdateActivityInput[] = [];
  archived: ArchiveActivityInput[] = [];
  statusChanges: ChangeActivityStatusInput[] = [];
  activities: StoredActivity[] = [];
  documents: { id: string; patientId: string }[] = [];

  async findPatientDocumentIds(
    patientId: string,
    ids: string[],
  ): Promise<string[]> {
    return this.documents
      .filter((item) => item.patientId === patientId && ids.includes(item.id))
      .map((item) => item.id);
  }

  async findByPts({
    ptsId,
    status,
    executor,
    page,
    limit,
  }: FindActivitiesInput) {
    const found = this.activities
      .filter(
        (activity) =>
          activity.ptsId === ptsId &&
          (!status || status.includes(activity.status)) &&
          (!executor || activity.executor === executor),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
      rows: found.slice((page - 1) * limit, page * limit).map(toResponse),
      total: found.length,
    };
  }

  async findById(activityId: string): Promise<StoredActivity | null> {
    const activity = this.activities.find((item) => item.id === activityId);

    return activity ? { ...activity } : null;
  }

  async findDetailsById(activityId: string) {
    const activity = this.activities.find((item) => item.id === activityId);

    return activity
      ? {
          ...activity,
          goal: activity.goalId
            ? { id: activity.goalId, title: 'Meta terapêutica' }
            : null,
          documents: activity.documentIds.map((id) => ({
            id,
            title: `Documento ${id}`,
          })),
          appointmentsCount: 0,
        }
      : null;
  }

  async create(input: CreateActivityInput): Promise<ActivityResponseDto> {
    this.created.push(input);
    const activity: StoredActivity = {
      id: `66666666-6666-4666-8666-66666666666${this.activities.length}`,
      ptsId: input.ptsId,
      ...input.values,
      executorProfessionalIds: input.executorProfessionalIds,
      documentIds: input.documentIds,
      status: ActivityState.Suggested,
      authorProfessionalId: input.authorProfessionalId,
      createdAt: '2026-12-01T13:00:00.000Z',
      updatedAt: null,
    };
    this.activities.push(activity);

    return toResponse(activity);
  }

  async update(input: UpdateActivityInput): Promise<ActivityResponseDto> {
    this.updated.push(input);
    const activity = this.activities.find(
      (item) => item.id === input.activityId,
    )!;
    Object.assign(activity, input.values, {
      ...(input.documentIds && { documentIds: input.documentIds }),
      updatedAt: '2026-12-02T13:00:00.000Z',
    });

    return toResponse(activity);
  }

  async archive(
    input: ArchiveActivityInput,
  ): Promise<ArchiveActivityResponseDto> {
    this.archived.push(input);
    const activity = this.activities.find(
      (item) => item.id === input.activityId,
    )!;
    activity.status = ActivityState.Archived;

    return {
      id: activity.id,
      status: ActivityState.Archived,
      archivedAt: '2026-12-06T12:00:00.000Z',
    };
  }

  async changeStatus(
    input: ChangeActivityStatusInput,
  ): Promise<ActivityStatusResponseDto> {
    this.statusChanges.push(input);
    const activity = this.activities.find(
      (item) => item.id === input.activityId,
    )!;
    const status = ACTIVITY_TRANSITIONS[input.action].to;
    activity.status = status;

    return { id: activity.id, status, changedAt: '2026-12-07T12:00:00.000Z' };
  }
}
