import { Injectable } from '@nestjs/common';
import { DataSource, In, type EntityManager } from 'typeorm';

import { ActivityEntity } from '../../activities/entities/activity.entity';
import { ActivityState } from '../../activities/enums/activity.enums';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import { TimelineRecordTarget } from '../../timeline/enums/timeline-record-target.enum';
import { TimelineRecordType } from '../../timeline/enums/timeline-record-type.enum';
import { TimelineRecorderService } from '../../timeline/services/timeline-recorder.service';
import { PtsGoalEntity } from '../entities/pts-goal.entity';
import { PtsEntity } from '../entities/pts.entity';
import { GoalOrigin, GoalStatus } from '../enums/goal.enums';
import { draftAlreadyExists, ptsNotFound, ptsNotRunning } from '../pts.errors';
import { nextPtsVersion } from '../pts-version';

export interface NextVersionActor {
  accountId: string;
  /** Profissional autor (RN029); nulo quando o admin age sem atribuir. */
  professionalId: string | null;
  name: string;
}

// A data máxima é escolhida pela equipe; o rascunho parte de 12 meses.
function oneYearAfter(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const result = new Date(Date.UTC(year + 1, month - 1, day));

  // 29/02 vira o último dia de fevereiro.
  if (result.getUTCDate() !== day) {
    result.setUTCDate(0);
  }

  return result.toISOString().slice(0, 10);
}

/** Rascunho da próxima versão (RFPTS013). Sem rota: a reavaliação chama. */
@Injectable()
export class PtsNextVersionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly timelineRecorder: TimelineRecorderService,
  ) {}

  /**
   * Chame depois de gravar o resultado das metas e antes de concluir o PTS e
   * encerrar as atividades: as copiadas são as que ainda estão em andamento.
   * Com `manager`, participa da transação de quem chama.
   */
  async createNextVersion(
    ptsId: string,
    reassessmentDate: string,
    actor: NextVersionActor,
    manager?: EntityManager,
  ): Promise<{ id: string; version: number }> {
    return manager
      ? this.create(ptsId, reassessmentDate, actor, manager)
      : this.dataSource.transaction((transaction) =>
          this.create(ptsId, reassessmentDate, actor, transaction),
        );
  }

  private async create(
    ptsId: string,
    reassessmentDate: string,
    actor: NextVersionActor,
    manager: EntityManager,
  ): Promise<{ id: string; version: number }> {
    const previous = await manager
      .createQueryBuilder(PtsEntity, 'pts')
      .setLock('pessimistic_write')
      .where('pts.id = :id', { id: ptsId })
      .getOne();

    if (!previous) {
      throw ptsNotFound();
    }

    if (previous.status !== PtsStateEnum.RUNNING) {
      throw ptsNotRunning();
    }

    const { patientId } = previous;
    const version = await nextPtsVersion(manager, patientId);

    // RN011: no máximo uma proposta em DRAFT por paciente.
    if (
      await manager.existsBy(PtsEntity, {
        patientId,
        status: PtsStateEnum.DRAFT,
      })
    ) {
      throw draftAlreadyExists();
    }

    const { identifiers } = await manager.insert(PtsEntity, {
      patientId,
      responsibleProfessionalId: previous.responsibleProfessionalId,
      status: PtsStateEnum.DRAFT,
      version,
      previousPtsId: ptsId,
      caseStudyDate: reassessmentDate,
      nextReviewAt: oneYearAfter(reassessmentDate),
      diagnosisSummary: previous.diagnosisSummary,
      cid: previous.cid,
      supportLevel: previous.supportLevel,
      strengths: previous.strengths,
      priorityNeeds: previous.priorityNeeds,
      socialSituation: previous.socialSituation,
      vulnerabilities: previous.vulnerabilities,
      comorbidities: previous.comorbidities,
      sensoryProfile: previous.sensoryProfile,
      communicationMethod: previous.communicationMethod,
    });
    const id = (identifiers[0] as { id: string }).id;

    await manager.query(
      `INSERT INTO professional_participating_on_therapeutic_journey
        (professional_id, therapeutic_journey_id)
       SELECT professional_id, $2::uuid
         FROM professional_participating_on_therapeutic_journey
        WHERE therapeutic_journey_id = $1`,
      [ptsId, id],
    );

    const goalIds = await this.copyGoals(manager, ptsId, id, actor);
    await this.copyActivities(manager, ptsId, id, goalIds, actor);

    await this.timelineRecorder.record(
      {
        type: TimelineRecordType.NextVersionCreated,
        targetType: TimelineRecordTarget.Pts,
        targetId: id,
        ptsId,
        description: `${actor.name} criou o rascunho do PTS v${version}`,
        authorProfessionalId: actor.professionalId,
        executedByAccountId: actor.accountId,
      },
      manager,
    );

    return { id, version };
  }

  /** Devolve o id da meta nova por id da anterior. */
  private async copyGoals(
    manager: EntityManager,
    fromPtsId: string,
    toPtsId: string,
    actor: NextVersionActor,
  ): Promise<Map<string, string>> {
    const goals = await manager.find(PtsGoalEntity, {
      where: {
        ptsId: fromPtsId,
        status: In([GoalStatus.PartiallyAchieved, GoalStatus.NotAchieved]),
      },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    const newIds = new Map<string, string>();

    for (const goal of goals) {
      const { identifiers } = await manager.insert(PtsGoalEntity, {
        ptsId: toPtsId,
        title: goal.title,
        description: goal.description,
        area: goal.area,
        measureCriterion: goal.measureCriterion,
        term: null,
        targetDate: null,
        origin:
          goal.status === GoalStatus.PartiallyAchieved
            ? GoalOrigin.KeptPartial
            : GoalOrigin.KeptNotAchieved,
        previousGoalId: goal.id,
        authorProfessionalId: actor.professionalId,
        registeredByAccountId: actor.accountId,
      });

      newIds.set(goal.id, (identifiers[0] as { id: string }).id);
    }

    return newIds;
  }

  private async copyActivities(
    manager: EntityManager,
    fromPtsId: string,
    toPtsId: string,
    goalIds: Map<string, string>,
    actor: NextVersionActor,
  ): Promise<void> {
    const activities = await manager.find(ActivityEntity, {
      where: { ptsId: fromPtsId, status: ActivityState.Running },
      order: { createdAt: 'ASC', id: 'ASC' },
    });

    for (const activity of activities) {
      // Nasce suggested (RN012), para a equipe revisar no rascunho.
      const { identifiers } = await manager.insert(ActivityEntity, {
        ptsId: toPtsId,
        title: activity.title,
        description: activity.description,
        type: activity.type,
        specialism: activity.specialism,
        frequency: activity.frequency,
        modality: activity.modality,
        visitPlace: activity.visitPlace,
        executor: activity.executor,
        goalId: activity.goalId ? (goalIds.get(activity.goalId) ?? null) : null,
        authorProfessionalId: activity.authorProfessionalId,
        registeredByAccountId: actor.accountId,
      });
      const params = [activity.id, (identifiers[0] as { id: string }).id];

      await manager.query(
        `INSERT INTO activity_executor (activity_id, professional_id)
         SELECT $2::uuid, professional_id FROM activity_executor
          WHERE activity_id = $1`,
        params,
      );
      await manager.query(
        `INSERT INTO activity_document (activity_id, document_id)
         SELECT $2::uuid, document_id FROM activity_document
          WHERE activity_id = $1`,
        params,
      );
    }
  }
}
