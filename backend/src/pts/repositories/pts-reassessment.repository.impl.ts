import { Injectable } from '@nestjs/common';
import { DataSource, In, type EntityManager } from 'typeorm';

import { ActivityEntity } from '../../activities/entities/activity.entity';
import { ActivityState } from '../../activities/enums/activity.enums';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import { TimelineRecordTarget } from '../../timeline/enums/timeline-record-target.enum';
import { TimelineRecordType } from '../../timeline/enums/timeline-record-type.enum';
import { TimelineRecorderService } from '../../timeline/services/timeline-recorder.service';
import type { RegisterReassessmentResponseDto } from '../dto/register-reassessment.dto';
import { PtsGoalEntity } from '../entities/pts-goal.entity';
import { PtsEntity } from '../entities/pts.entity';
import { ptsNotFound } from '../pts.errors';
import { assertGoalsAssessed } from '../reassessment-rules';
import {
  reassessmentForbidden,
  reassessmentNotRunning,
} from '../reassessment.errors';
import {
  PtsNextVersionService,
  type NextVersionActor,
} from '../services/pts-next-version.service';
import {
  PtsReassessmentRepository,
  type RegisterReassessmentInput,
} from './pts-reassessment.repository';

@Injectable()
export class PtsReassessmentRepositoryImpl extends PtsReassessmentRepository {
  constructor(
    private readonly dataSource: DataSource,
    private readonly timelineRecorder: TimelineRecorderService,
    private readonly nextVersionService: PtsNextVersionService,
  ) {
    super();
  }

  async register(
    input: RegisterReassessmentInput,
  ): Promise<RegisterReassessmentResponseDto> {
    const { ptsId, meetingDate, reason, actor } = input;

    return this.dataSource.transaction(async (manager) => {
      // Trava o PTS e refaz as checagens: encerramento, transferência da
      // responsabilidade ou meta nova ao mesmo tempo não passam.
      const pts = await manager
        .createQueryBuilder(PtsEntity, 'pts')
        .setLock('pessimistic_write')
        .where('pts.id = :id', { id: ptsId })
        .getOne();

      if (!pts) {
        throw ptsNotFound();
      }

      if (
        actor.professionalId !== null &&
        pts.responsibleProfessionalId !== actor.professionalId
      ) {
        throw reassessmentForbidden();
      }

      if (pts.status !== PtsStateEnum.RUNNING) {
        throw reassessmentNotRunning();
      }

      const goals = await manager.find(PtsGoalEntity, {
        where: { ptsId },
        select: { id: true, status: true },
      });

      assertGoalsAssessed(goals, input.goals);

      const now = new Date();

      for (const { goalId, status, note } of input.goals) {
        await manager.update(
          PtsGoalEntity,
          { id: goalId, ptsId },
          {
            status,
            resultNote: note,
            resultRecordedAt: now,
            resultRecordedByAccountId: actor.accountId,
            updatedAt: now,
          },
        );
      }

      await manager.update(PtsEntity, ptsId, {
        reassessedAt: meetingDate,
        reassessedByAccountId: actor.accountId,
      });
      await this.record(manager, ptsId, actor, {
        type: TimelineRecordType.PtsReassessed,
        targetType: TimelineRecordTarget.Pts,
        targetId: ptsId,
        description: `${actor.name} registrou a reavaliação do PTS`,
      });

      // Antes de concluir: a próxima versão copia as metas parciais e não
      // atingidas e as atividades ainda em andamento (RFPTS013).
      const next = input.createNextVersion
        ? await this.nextVersionService.createNextVersion(
            ptsId,
            meetingDate,
            actor,
            manager,
          )
        : null;

      // Conclui como o encerramento do PTS (RFPTS010).
      await manager.update(PtsEntity, ptsId, {
        status: PtsStateEnum.CONCLUDED,
        concludedAt: now,
        closingDate: meetingDate,
        closingReason: reason,
        closedByAccountId: actor.accountId,
      });
      await this.record(manager, ptsId, actor, {
        type: TimelineRecordType.PtsConcluded,
        targetType: TimelineRecordTarget.Pts,
        targetId: ptsId,
        description: `${actor.name} concluiu o PTS${reason ? ` (${reason})` : ''}`,
      });
      await this.concludeActivities(manager, ptsId, actor, now);

      return {
        id: ptsId,
        status: 'concluded' as const,
        reassessedAt: meetingDate,
        nextPtsId: next?.id ?? null,
      };
    });
  }

  // As atividades em andamento ou suspensas são concluídas junto, cada uma
  // com o seu evento, como no encerramento do PTS.
  private async concludeActivities(
    manager: EntityManager,
    ptsId: string,
    actor: NextVersionActor,
    now: Date,
  ): Promise<void> {
    const activities = await manager.find(ActivityEntity, {
      where: {
        ptsId,
        status: In([ActivityState.Running, ActivityState.Suspended]),
      },
      select: { id: true, title: true },
      order: { createdAt: 'ASC', id: 'ASC' },
    });

    if (activities.length === 0) {
      return;
    }

    await manager.update(
      ActivityEntity,
      { id: In(activities.map(({ id }) => id)) },
      {
        status: ActivityState.Concluded,
        statusChangedByAccountId: actor.accountId,
        updatedAt: now,
        concludedAt: now,
      },
    );

    for (const activity of activities) {
      await this.record(manager, ptsId, actor, {
        type: TimelineRecordType.ActivityConcluded,
        targetType: TimelineRecordTarget.Activity,
        targetId: activity.id,
        description: `${actor.name} concluiu a atividade ${activity.title}`,
      });
    }
  }

  private async record(
    manager: EntityManager,
    ptsId: string,
    actor: NextVersionActor,
    event: {
      type: TimelineRecordType;
      targetType: TimelineRecordTarget;
      targetId: string;
      description: string;
    },
  ): Promise<void> {
    await this.timelineRecorder.record(
      {
        ...event,
        ptsId,
        authorProfessionalId: actor.professionalId,
        executedByAccountId: actor.accountId,
      },
      manager,
    );
  }
}
