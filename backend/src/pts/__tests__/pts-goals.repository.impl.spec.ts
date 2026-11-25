import { jest } from '@jest/globals';
import type { DataSource, EntityManager, Repository } from 'typeorm';

import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import { TimelineRecordType } from '../../timeline/enums/timeline-record-type.enum';
import type { TimelineRecorderService } from '../../timeline/services/timeline-recorder.service';
import { PtsEntity } from '../entities/pts.entity';
import { PtsGoalEntity } from '../entities/pts-goal.entity';
import { PtsGoalsRepositoryImpl } from '../repositories/pts-goals.repository.impl';
import { goalBody } from './goal-fixtures';
import { expectApiError } from './test-utils';

const executor = {
  authorProfessionalId: 'prof-2',
  executedByAccountId: 'acc-2',
  description: 'João Lima mexeu na meta',
};

const goalRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'goal-1',
  ptsId: 'pts-1',
  ...goalBody(),
  status: 'in_progress',
  resultNote: null,
  origin: 'new',
  authorProfessionalId: 'prof-2',
  authorProfessional: {
    id: 'prof-2',
    account: { name: 'João da Silva', socialName: 'João Lima' },
  },
  registeredByAccountId: 'acc-admin',
  registeredBy: { name: 'Kaio', socialName: null },
  createdAt: new Date('2026-11-25T12:00:00.000Z'),
  ...overrides,
});

function setup({
  pts = {
    id: 'pts-1',
    status: PtsStateEnum.RUNNING,
    nextReviewAt: '2027-03-31',
  } as Partial<PtsEntity> | null,
  goal = goalRow() as unknown,
  total = 2,
  activities = [] as { goalId: string }[],
} = {}) {
  const query = {
    setLock: jest.fn(),
    where: jest.fn(),
    getOne: jest.fn(async () => pts),
  };
  query.setLock.mockReturnValue(query);
  query.where.mockReturnValue(query);

  const manager = {
    createQueryBuilder: jest.fn(() => query),
    insert: jest.fn(async () => ({ identifiers: [{ id: 'goal-1' }] })),
    update: jest.fn(async () => ({ affected: 1 })),
    softDelete: jest.fn(async () => ({ affected: 1 })),
    findOne: jest.fn(async () => goal),
    count: jest.fn(async () => total),
    find: jest.fn(async () => activities),
  };
  const dataSource = {
    transaction: (run: (m: EntityManager) => Promise<unknown>) =>
      run(manager as unknown as EntityManager),
  };
  const recorder = { record: jest.fn(async () => undefined) };
  const goals = { find: jest.fn(async () => [goal]), manager };
  const repository = new PtsGoalsRepositoryImpl(
    dataSource as unknown as DataSource,
    goals as unknown as Repository<PtsGoalEntity>,
    {} as Repository<PtsEntity>,
    recorder as unknown as TimelineRecorderService,
  );

  return { repository, query, manager, recorder, goals };
}

describe('PtsGoalsRepositoryImpl', () => {
  it('lista as metas do PTS na ordem de cadastro, com a autoria', async () => {
    const { repository, goals } = setup();

    const [goal] = await repository.findByPts('pts-1');

    expect(goals.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ptsId: 'pts-1' },
        order: { createdAt: 'ASC', id: 'ASC' },
      }),
    );
    expect(goal).toEqual({
      id: 'goal-1',
      ...goalBody(),
      status: 'in_progress',
      resultNote: null,
      origin: 'new',
      activitiesCount: 0,
      registeredBy: { id: 'prof-2', name: 'João Lima' },
      createdAt: '2026-11-25T12:00:00.000Z',
    });
  });

  it('conta as atividades ligadas e recusa excluir a meta (GOAL_HAS_ACTIVITIES)', async () => {
    const { repository, manager } = setup({
      activities: [{ goalId: 'goal-1' }, { goalId: 'goal-1' }],
    });

    const [goal] = await repository.findByPts('pts-1');
    expect(goal.activitiesCount).toBe(2);

    await expectApiError(
      () =>
        repository.remove({ ptsId: 'pts-1', goalId: 'goal-1', ...executor }),
      409,
      'GOAL_HAS_ACTIVITIES',
    );
    expect(manager.softDelete).not.toHaveBeenCalled();
  });

  it('sem profissional atribuído, a meta é da conta que registrou (RN029)', async () => {
    const { repository } = setup({
      goal: goalRow({ authorProfessionalId: null, authorProfessional: null }),
    });

    const [goal] = await repository.findByPts('pts-1');

    expect(goal.registeredBy).toEqual({ id: 'acc-admin', name: 'Kaio' });
  });

  it('cadastra com a autoria e o goal_added na mesma transação', async () => {
    const { repository, query, manager, recorder } = setup();

    await repository.create({
      ptsId: 'pts-1',
      values: goalBody(),
      ...executor,
    });

    expect(query.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(manager.insert).toHaveBeenCalledWith(PtsGoalEntity, {
      ...goalBody(),
      ptsId: 'pts-1',
      authorProfessionalId: 'prof-2',
      registeredByAccountId: 'acc-2',
    });
    expect(recorder.record).toHaveBeenCalledWith(
      {
        type: TimelineRecordType.GoalAdded,
        targetType: 'pts',
        targetId: 'goal-1',
        ptsId: 'pts-1',
        ...executor,
      },
      manager,
    );
  });

  it('edita e grava o goal_updated', async () => {
    const { repository, manager, recorder } = setup();

    await repository.update({
      ptsId: 'pts-1',
      goalId: 'goal-1',
      changes: { title: 'Novo' },
      ...executor,
    });

    expect(manager.update).toHaveBeenCalledWith(
      PtsGoalEntity,
      { id: 'goal-1', ptsId: 'pts-1' },
      { title: 'Novo', updatedAt: expect.any(Date) },
    );
    expect(recorder.record).toHaveBeenCalledWith(
      expect.objectContaining({ type: TimelineRecordType.GoalUpdated }),
      manager,
    );
  });

  it('exclui de forma lógica (RN021) e grava o goal_removed', async () => {
    const { repository, manager, recorder } = setup();

    await repository.remove({ ptsId: 'pts-1', goalId: 'goal-1', ...executor });

    expect(manager.softDelete).toHaveBeenCalledWith(PtsGoalEntity, {
      id: 'goal-1',
      ptsId: 'pts-1',
    });
    expect(recorder.record).toHaveBeenCalledWith(
      expect.objectContaining({ type: TimelineRecordType.GoalRemoved }),
      manager,
    );
  });

  it('refaz as checagens com o PTS travado e não grava nada na recusa', async () => {
    const missing = setup({ pts: null });
    const closed = setup({
      pts: { id: 'pts-1', status: PtsStateEnum.CONCLUDED },
    });
    const shorter = setup({
      pts: {
        id: 'pts-1',
        status: PtsStateEnum.RUNNING,
        nextReviewAt: '2027-01-01',
      },
    });
    const last = setup({ total: 1 });
    const gone = setup({ goal: null });
    const input = { ptsId: 'pts-1', goalId: 'goal-1', ...executor };

    await expectApiError(
      () => missing.repository.create({ ...input, values: goalBody() }),
      404,
      'PTS_NOT_FOUND',
    );
    await expectApiError(
      () => closed.repository.create({ ...input, values: goalBody() }),
      409,
      'PTS_NOT_EDITABLE',
    );
    await expectApiError(
      () => shorter.repository.create({ ...input, values: goalBody() }),
      400,
      'VALIDATION_ERROR',
    );
    await expectApiError(() => last.repository.remove(input), 409, 'LAST_GOAL');
    await expectApiError(
      () => gone.repository.update({ ...input, changes: { title: 'A' } }),
      404,
      'GOAL_NOT_FOUND',
    );

    for (const { manager, recorder } of [
      missing,
      closed,
      shorter,
      last,
      gone,
    ]) {
      expect(manager.insert).not.toHaveBeenCalled();
      expect(manager.update).not.toHaveBeenCalled();
      expect(manager.softDelete).not.toHaveBeenCalled();
      expect(recorder.record).not.toHaveBeenCalled();
    }
  });
});
