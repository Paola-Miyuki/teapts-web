import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  In,
  IsNull,
  Repository,
  type EntityManager,
} from 'typeorm';

import { DocumentEntity } from '../../documents/entities/document.entity';
import { PtsGoalEntity } from '../../pts/entities/pts-goal.entity';
import { PtsEntity } from '../../pts/entities/pts.entity';
import { assertPtsEditable } from '../../pts/goal-rules';
import { ptsNotFound } from '../../pts/pts.errors';
import { TimelineRecordTarget } from '../../timeline/enums/timeline-record-target.enum';
import { TimelineRecordType } from '../../timeline/enums/timeline-record-type.enum';
import { TimelineRecorderService } from '../../timeline/services/timeline-recorder.service';
import {
  activityNotFound,
  invalidActivityDocuments,
  invalidActivityGoal,
} from '../activities.errors';
import {
  assertActivityArchivable,
  assertActivityEditable,
} from '../activity-rules';
import type { ActivityResponseDto } from '../dto/activity-response.dto';
import type { ArchiveActivityResponseDto } from '../dto/archive-activity.dto';
import type { ActivityFrequencyDto } from '../dto/create-activity.dto';
import { ActivityDocumentEntity } from '../entities/activity-document.entity';
import {
  ActivityEntity,
  type StoredFrequency,
} from '../entities/activity.entity';
import { ActivityState } from '../enums/activity.enums';
import {
  ActivitiesRepository,
  type ArchiveActivityInput,
  type CreateActivityInput,
  type StoredActivity,
  type UpdateActivityInput,
} from './activities.repository';

const LINKS = { executors: true, documents: true } as const;

async function findDocumentIds(
  manager: EntityManager,
  patientId: string,
  ids: string[],
): Promise<string[]> {
  const documents = await manager.find(DocumentEntity, {
    where: { id: In(ids), patientId, deletedAt: IsNull() },
    select: { id: true },
  });

  return documents.map(({ id }) => id);
}

function toStoredFrequency(frequency: ActivityFrequencyDto): StoredFrequency {
  return {
    quantity: frequency.quantity,
    period: frequency.period,
    duration_minutes: frequency.durationMinutes,
  };
}

@Injectable()
export class ActivitiesRepositoryImpl extends ActivitiesRepository {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ActivityEntity)
    private readonly activities: Repository<ActivityEntity>,
    private readonly timelineRecorder: TimelineRecorderService,
  ) {
    super();
  }

  async findByPts(ptsId: string): Promise<ActivityResponseDto[]> {
    const activities = await this.activities.find({
      where: { ptsId },
      relations: LINKS,
      order: { createdAt: 'DESC', id: 'DESC' },
    });

    return activities.map((activity) => this.toResponse(activity));
  }

  async findById(activityId: string): Promise<StoredActivity | null> {
    const activity = await this.activities.findOne({
      where: { id: activityId },
      relations: LINKS,
    });

    return activity
      ? { ...this.toResponse(activity), ptsId: activity.ptsId }
      : null;
  }

  async findPatientDocumentIds(
    patientId: string,
    ids: string[],
  ): Promise<string[]> {
    return findDocumentIds(this.dataSource.manager, patientId, ids);
  }

  async create(input: CreateActivityInput): Promise<ActivityResponseDto> {
    const { ptsId, values, executorProfessionalIds, documentIds } = input;

    return this.dataSource.transaction(async (manager) => {
      const pts = await this.lockPts(manager, ptsId);

      if (
        values.goalId &&
        !(await manager.existsBy(PtsGoalEntity, { id: values.goalId, ptsId }))
      ) {
        throw invalidActivityGoal();
      }

      await this.assertDocuments(manager, pts.patientId, documentIds);

      const { frequency, ...columns } = values;
      const { identifiers } = await manager.insert(ActivityEntity, {
        ...columns,
        frequency: toStoredFrequency(frequency),
        ptsId,
        authorProfessionalId: input.authorProfessionalId,
        registeredByAccountId: input.executedByAccountId,
      });
      const activityId = (identifiers[0] as { id: string }).id;

      if (executorProfessionalIds.length > 0) {
        await manager
          .createQueryBuilder()
          .relation(ActivityEntity, 'executors')
          .of(activityId)
          .add(executorProfessionalIds);
      }

      if (documentIds.length > 0) {
        await manager.insert(
          ActivityDocumentEntity,
          documentIds.map((documentId) => ({ activityId, documentId })),
        );
      }

      await this.record(
        manager,
        TimelineRecordType.ActivitySuggested,
        { ...input, activityId },
        input.description,
      );

      return this.loadResponse(manager, activityId);
    });
  }

  async update(input: UpdateActivityInput): Promise<ActivityResponseDto> {
    const { ptsId, activityId, values, documentIds } = input;

    return this.dataSource.transaction(async (manager) => {
      const pts = await this.lockPts(manager, ptsId);
      const activity = await this.lockActivity(manager, ptsId, activityId);

      assertActivityEditable(activity.status, input.allowedStates);

      if (
        values.goalId &&
        values.goalId !== activity.goalId &&
        !(await manager.existsBy(PtsGoalEntity, { id: values.goalId, ptsId }))
      ) {
        throw invalidActivityGoal();
      }

      if (documentIds) {
        await this.assertDocuments(manager, pts.patientId, documentIds);
      }

      const { frequency, ...columns } = values;
      await manager.update(
        ActivityEntity,
        { id: activityId, ptsId },
        {
          ...columns,
          frequency: toStoredFrequency(frequency),
          updatedAt: new Date(),
        },
      );

      if (documentIds) {
        await this.syncDocuments(manager, activityId, documentIds);
      }

      await this.record(
        manager,
        TimelineRecordType.ActivityUpdated,
        input,
        input.description,
      );

      if (activity.goalId !== null && values.goalId === null) {
        await this.record(
          manager,
          TimelineRecordType.ActivityGoalUnlinked,
          input,
          input.goalUnlinkedDescription,
        );
      }

      return this.loadResponse(manager, activityId);
    });
  }

  async archive(
    input: ArchiveActivityInput,
  ): Promise<ArchiveActivityResponseDto> {
    const { ptsId, activityId } = input;

    return this.dataSource.transaction(async (manager) => {
      await this.lockPts(manager, ptsId);
      const activity = await this.lockActivity(manager, ptsId, activityId);

      assertActivityArchivable(activity.status);

      // Exclusão lógica (RN021): a linha e os atendimentos continuam.
      const archivedAt = new Date();
      await manager.update(
        ActivityEntity,
        { id: activityId, ptsId },
        {
          status: ActivityState.Archived,
          archivedAt,
          statusReason: input.reason,
          statusChangedByAccountId: input.executedByAccountId,
          updatedAt: archivedAt,
        },
      );
      await this.record(
        manager,
        TimelineRecordType.ActivityArchived,
        input,
        input.description,
      );

      return {
        id: activityId,
        status: ActivityState.Archived,
        archivedAt: archivedAt.toISOString(),
      };
    });
  }

  // Trava o PTS e refaz as checagens: encerramento do PTS ou exclusão da
  // meta ao mesmo tempo não passa.
  private async lockPts(
    manager: EntityManager,
    ptsId: string,
  ): Promise<PtsEntity> {
    const pts = await manager
      .createQueryBuilder(PtsEntity, 'pts')
      .setLock('pessimistic_write')
      .where('pts.id = :id', { id: ptsId })
      .getOne();

    if (!pts) {
      throw ptsNotFound();
    }

    assertPtsEditable(pts.status);

    return pts;
  }

  // Trava a atividade e refaz a checagem: mudança de estado ao mesmo tempo
  // (rejeitar, arquivar, aprovar) não passa.
  private async lockActivity(
    manager: EntityManager,
    ptsId: string,
    activityId: string,
  ): Promise<ActivityEntity> {
    const activity = await manager.findOne(ActivityEntity, {
      where: { id: activityId, ptsId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!activity) {
      throw activityNotFound();
    }

    return activity;
  }

  private async assertDocuments(
    manager: EntityManager,
    patientId: string,
    documentIds: string[],
  ): Promise<void> {
    if (documentIds.length === 0) {
      return;
    }

    const found = await findDocumentIds(manager, patientId, documentIds);

    if (found.length !== documentIds.length) {
      throw invalidActivityDocuments();
    }
  }

  // Mantém os vínculos que continuam (e a data deles), apaga os que saíram e
  // cria os novos.
  private async syncDocuments(
    manager: EntityManager,
    activityId: string,
    documentIds: string[],
  ): Promise<void> {
    const current = (
      await manager.find(ActivityDocumentEntity, {
        where: { activityId },
        select: { documentId: true },
      })
    ).map(({ documentId }) => documentId);
    const removed = current.filter((id) => !documentIds.includes(id));
    const added = documentIds.filter((id) => !current.includes(id));

    if (removed.length > 0) {
      await manager.delete(ActivityDocumentEntity, {
        activityId,
        documentId: In(removed),
      });
    }

    if (added.length > 0) {
      await manager.insert(
        ActivityDocumentEntity,
        added.map((documentId) => ({ activityId, documentId })),
      );
    }
  }

  private async record(
    manager: EntityManager,
    type: TimelineRecordType,
    input: {
      ptsId: string;
      activityId: string;
      authorProfessionalId: string | null;
      executedByAccountId: string;
    },
    description: string,
  ): Promise<void> {
    await this.timelineRecorder.record(
      {
        type,
        targetType: TimelineRecordTarget.Activity,
        targetId: input.activityId,
        ptsId: input.ptsId,
        description,
        authorProfessionalId: input.authorProfessionalId,
        executedByAccountId: input.executedByAccountId,
      },
      manager,
    );
  }

  private async loadResponse(
    manager: EntityManager,
    activityId: string,
  ): Promise<ActivityResponseDto> {
    return this.toResponse(
      await manager.findOneOrFail(ActivityEntity, {
        where: { id: activityId },
        relations: LINKS,
      }),
    );
  }

  private toResponse(activity: ActivityEntity): ActivityResponseDto {
    const { quantity, period, duration_minutes } = activity.frequency;

    return {
      id: activity.id,
      title: activity.title,
      description: activity.description,
      type: activity.type,
      specialism: activity.specialism,
      frequency: { quantity, period, durationMinutes: duration_minutes },
      modality: activity.modality,
      visitPlace: activity.visitPlace,
      executor: activity.executor,
      executorProfessionalIds: (activity.executors ?? []).map(({ id }) => id),
      goalId: activity.goalId,
      documentIds: (activity.documents ?? []).map(
        ({ documentId }) => documentId,
      ),
      status: activity.status,
      authorProfessionalId: activity.authorProfessionalId ?? null,
      createdAt: activity.createdAt.toISOString(),
      updatedAt: activity.updatedAt?.toISOString() ?? null,
    };
  }
}
