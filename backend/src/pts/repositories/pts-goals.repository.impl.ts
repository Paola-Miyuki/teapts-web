import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  IsNull,
  Not,
  Repository,
  type EntityManager,
} from 'typeorm';

import { ActivityEntity } from '../../activities/entities/activity.entity';
import { Account } from '../../accounts/entities/account.entity';
import { TimelineRecordTarget } from '../../timeline/enums/timeline-record-target.enum';
import { TimelineRecordType } from '../../timeline/enums/timeline-record-type.enum';
import { TimelineRecorderService } from '../../timeline/services/timeline-recorder.service';
import type { GoalResponseDto } from '../dto/goal-response.dto';
import { PtsGoalEntity } from '../entities/pts-goal.entity';
import { PtsEntity } from '../entities/pts.entity';
import {
  assertGoalRemovable,
  assertPtsEditable,
  assertTargetDate,
} from '../goal-rules';
import { goalNotFound, ptsNotFound } from '../pts.errors';
import {
  PtsGoalsRepository,
  type CreateGoalInput,
  type GoalPtsTarget,
  type RemoveGoalInput,
  type UpdateGoalInput,
} from './pts-goals.repository';

const AUTHORSHIP = {
  authorProfessional: { account: true },
  registeredBy: true,
} as const;

function displayName(account?: Pick<Account, 'name' | 'socialName'> | null) {
  return account?.socialName?.trim() || account?.name || '';
}

@Injectable()
export class PtsGoalsRepositoryImpl extends PtsGoalsRepository {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(PtsGoalEntity)
    private readonly goals: Repository<PtsGoalEntity>,
    @InjectRepository(PtsEntity)
    private readonly ptsRepository: Repository<PtsEntity>,
    private readonly timelineRecorder: TimelineRecorderService,
  ) {
    super();
  }

  async findPtsTarget(ptsId: string): Promise<GoalPtsTarget | null> {
    const pts = await this.ptsRepository.findOne({
      where: { id: ptsId },
      relations: { team: true },
    });

    if (!pts) {
      return null;
    }

    return {
      id: pts.id,
      status: pts.status,
      patientId: pts.patientId,
      responsibleProfessionalId: pts.responsibleProfessionalId,
      teamProfessionalIds: (pts.team ?? []).map((member) => member.id),
      nextReviewAt: pts.nextReviewAt,
    };
  }

  async findAccountDisplayName(accountId: string): Promise<string | null> {
    const account = await this.dataSource.getRepository(Account).findOne({
      where: { id: accountId },
      select: { id: true, name: true, socialName: true },
    });

    return account ? displayName(account) : null;
  }

  async findByPts(ptsId: string): Promise<GoalResponseDto[]> {
    const goals = await this.goals.find({
      where: { ptsId },
      relations: AUTHORSHIP,
      order: { createdAt: 'ASC', id: 'ASC' },
    });

    const counts = await this.countActivities(this.goals.manager, ptsId);

    return goals.map((goal) => this.toResponse(goal, counts));
  }

  async create(input: CreateGoalInput): Promise<GoalResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const pts = await this.lockPts(manager, input.ptsId);
      assertTargetDate(input.values.targetDate, pts.nextReviewAt);

      const { identifiers } = await manager.insert(PtsGoalEntity, {
        ...input.values,
        ptsId: input.ptsId,
        authorProfessionalId: input.authorProfessionalId,
        registeredByAccountId: input.executedByAccountId,
      });
      const goalId = (identifiers[0] as { id: string }).id;

      await this.record(manager, TimelineRecordType.GoalAdded, {
        ...input,
        goalId,
      });

      return this.loadResponse(manager, input.ptsId, goalId);
    });
  }

  async update(input: UpdateGoalInput): Promise<GoalResponseDto> {
    const { ptsId, goalId } = input;

    return this.dataSource.transaction(async (manager) => {
      const pts = await this.lockPts(manager, ptsId);
      await this.loadGoal(manager, ptsId, goalId);
      assertTargetDate(input.changes.targetDate, pts.nextReviewAt);

      await manager.update(
        PtsGoalEntity,
        { id: goalId, ptsId },
        { ...input.changes, updatedAt: new Date() },
      );
      await this.record(manager, TimelineRecordType.GoalUpdated, input);

      return this.loadResponse(manager, ptsId, goalId);
    });
  }

  async remove(input: RemoveGoalInput): Promise<void> {
    const { ptsId, goalId } = input;

    await this.dataSource.transaction(async (manager) => {
      await this.lockPts(manager, ptsId);
      await this.loadGoal(manager, ptsId, goalId);
      assertGoalRemovable(
        await manager.count(PtsGoalEntity, { where: { ptsId } }),
        (await this.countActivities(manager, ptsId)).get(goalId) ?? 0,
      );

      await manager.softDelete(PtsGoalEntity, { id: goalId, ptsId });
      await this.record(manager, TimelineRecordType.GoalRemoved, input);
    });
  }

  // Trava o PTS e refaz a checagem: encerramento ou exclusão simultânea não passa.
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

  private async loadGoal(
    manager: EntityManager,
    ptsId: string,
    goalId: string,
  ): Promise<PtsGoalEntity> {
    const goal = await manager.findOne(PtsGoalEntity, {
      where: { id: goalId, ptsId },
      relations: AUTHORSHIP,
    });

    if (!goal) {
      throw goalNotFound();
    }

    return goal;
  }

  private async record(
    manager: EntityManager,
    type: TimelineRecordType,
    input: RemoveGoalInput,
  ): Promise<void> {
    await this.timelineRecorder.record(
      {
        type,
        targetType: TimelineRecordTarget.Pts,
        targetId: input.goalId,
        ptsId: input.ptsId,
        description: input.description,
        authorProfessionalId: input.authorProfessionalId,
        executedByAccountId: input.executedByAccountId,
      },
      manager,
    );
  }

  /** Quantidade de atividades ligadas, por meta do PTS. */
  private async countActivities(
    manager: EntityManager,
    ptsId: string,
  ): Promise<Map<string, number>> {
    const linked = await manager.find(ActivityEntity, {
      where: { ptsId, goalId: Not(IsNull()) },
      select: { id: true, goalId: true },
    });
    const counts = new Map<string, number>();

    for (const { goalId } of linked) {
      counts.set(goalId!, (counts.get(goalId!) ?? 0) + 1);
    }

    return counts;
  }

  private async loadResponse(
    manager: EntityManager,
    ptsId: string,
    goalId: string,
  ): Promise<GoalResponseDto> {
    return this.toResponse(
      await this.loadGoal(manager, ptsId, goalId),
      await this.countActivities(manager, ptsId),
    );
  }

  private toResponse(
    goal: PtsGoalEntity,
    counts: Map<string, number>,
  ): GoalResponseDto {
    const author = goal.authorProfessional;

    return {
      id: goal.id,
      title: goal.title,
      description: goal.description,
      term: goal.term,
      area: goal.area,
      measureCriterion: goal.measureCriterion,
      targetDate: goal.targetDate,
      status: goal.status,
      resultNote: goal.resultNote,
      origin: goal.origin,
      activitiesCount: counts.get(goal.id) ?? 0,
      registeredBy: author
        ? { id: author.id, name: displayName(author.account) }
        : {
            id: goal.registeredByAccountId,
            name: displayName(goal.registeredBy),
          },
      createdAt: goal.createdAt.toISOString(),
    };
  }
}
