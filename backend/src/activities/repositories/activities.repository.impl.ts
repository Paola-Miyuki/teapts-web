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
  invalidActivityDocuments,
  invalidActivityGoal,
} from '../activities.errors';
import type { ActivityResponseDto } from '../dto/activity-response.dto';
import { ActivityDocumentEntity } from '../entities/activity-document.entity';
import { ActivityEntity } from '../entities/activity.entity';
import {
  ActivitiesRepository,
  type CreateActivityInput,
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

  async findPatientDocumentIds(
    patientId: string,
    ids: string[],
  ): Promise<string[]> {
    return findDocumentIds(this.dataSource.manager, patientId, ids);
  }

  async create(input: CreateActivityInput): Promise<ActivityResponseDto> {
    const { ptsId, values, executorProfessionalIds, documentIds } = input;

    return this.dataSource.transaction(async (manager) => {
      // Trava o PTS e refaz as checagens: encerramento do PTS ou exclusão da
      // meta ao mesmo tempo não passa.
      const pts = await manager
        .createQueryBuilder(PtsEntity, 'pts')
        .setLock('pessimistic_write')
        .where('pts.id = :id', { id: ptsId })
        .getOne();

      if (!pts) {
        throw ptsNotFound();
      }

      assertPtsEditable(pts.status);

      if (
        values.goalId &&
        !(await manager.existsBy(PtsGoalEntity, { id: values.goalId, ptsId }))
      ) {
        throw invalidActivityGoal();
      }

      if (documentIds.length > 0) {
        const found = await findDocumentIds(
          manager,
          pts.patientId,
          documentIds,
        );

        if (found.length !== documentIds.length) {
          throw invalidActivityDocuments();
        }
      }

      const { frequency, ...columns } = values;
      const { identifiers } = await manager.insert(ActivityEntity, {
        ...columns,
        frequency: {
          quantity: frequency.quantity,
          period: frequency.period,
          duration_minutes: frequency.durationMinutes,
        },
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

      await this.timelineRecorder.record(
        {
          type: TimelineRecordType.ActivitySuggested,
          targetType: TimelineRecordTarget.Activity,
          targetId: activityId,
          ptsId,
          description: input.description,
          authorProfessionalId: input.authorProfessionalId,
          executedByAccountId: input.executedByAccountId,
        },
        manager,
      );

      return this.toResponse(
        await manager.findOneOrFail(ActivityEntity, {
          where: { id: activityId },
          relations: LINKS,
        }),
      );
    });
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
      createdAt: activity.createdAt.toISOString(),
    };
  }
}
