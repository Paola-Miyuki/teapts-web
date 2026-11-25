import { jest } from '@jest/globals';
import {
  In,
  type DataSource,
  type EntityManager,
  type Repository,
} from 'typeorm';

import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import { expectApiError } from '../../pts/__tests__/test-utils';
import { PtsGoalEntity } from '../../pts/entities/pts-goal.entity';
import type { PtsEntity } from '../../pts/entities/pts.entity';
import type { TimelineRecorderService } from '../../timeline/services/timeline-recorder.service';
import { ActivityDocumentEntity } from '../entities/activity-document.entity';
import { ActivityEntity } from '../entities/activity.entity';
import { ActivityExecutor, ActivityState } from '../enums/activity.enums';
import { activityBody } from '../__tests__/activity-fixtures';
import { ActivitiesRepositoryImpl } from './activities.repository.impl';
import type {
  CreateActivityInput,
  UpdateActivityInput,
} from './activities.repository';

const STORED_FREQUENCY = {
  quantity: 1,
  period: 'weekly',
  duration_minutes: 45,
};

const input = (
  overrides: Partial<CreateActivityInput> = {},
): CreateActivityInput => ({
  ptsId: 'pts-1',
  values: {
    ...activityBody(),
    executor: ActivityExecutor.Team,
    visitPlace: null,
    goalId: 'goal-1',
  },
  executorProfessionalIds: ['prof-1'],
  documentIds: ['doc-1'],
  authorProfessionalId: 'prof-2',
  executedByAccountId: 'acc-2',
  description: 'João Lima sugeriu a atividade Integração sensorial',
  ...overrides,
});

const updateInput = (
  overrides: Partial<UpdateActivityInput> = {},
): UpdateActivityInput => ({
  ptsId: 'pts-1',
  activityId: 'act-1',
  values: {
    title: 'Circuito sensorial',
    description: activityBody().description,
    type: activityBody().type,
    frequency: activityBody().frequency,
    modality: activityBody().modality,
    visitPlace: null,
    goalId: null,
  },
  documentIds: ['doc-1', 'doc-3'],
  allowedStates: [ActivityState.Suggested],
  authorProfessionalId: 'prof-2',
  executedByAccountId: 'acc-2',
  description: 'João Lima atualizou a atividade Circuito sensorial',
  goalUnlinkedDescription:
    'João Lima desligou a atividade Circuito sensorial da meta',
  ...overrides,
});

function setup({
  pts = {
    id: 'pts-1',
    status: PtsStateEnum.RUNNING,
    patientId: 'patient-1',
  } as Partial<PtsEntity> | null,
  goals = 1,
  documents = [{ id: 'doc-1' }] as { id: string }[],
  activity = {
    id: 'act-1',
    status: ActivityState.Suggested,
    goalId: 'goal-1',
  } as Partial<ActivityEntity> | null,
  linked = [{ documentId: 'doc-1' }, { documentId: 'doc-2' }],
} = {}) {
  const row = {
    id: 'act-1',
    ptsId: 'pts-1',
    ...input().values,
    frequency: STORED_FREQUENCY,
    status: 'suggested',
    executors: [{ id: 'prof-1' }],
    documents: [{ documentId: 'doc-1' }],
    authorProfessionalId: 'prof-2',
    createdAt: new Date('2026-12-01T13:00:00.000Z'),
    updatedAt: null,
  };
  const query = {
    setLock: jest.fn(),
    where: jest.fn(),
    relation: jest.fn(),
    of: jest.fn(),
    getOne: jest.fn(async () => pts),
    add: jest.fn(async () => undefined),
  };
  for (const method of [query.setLock, query.where, query.relation, query.of]) {
    method.mockReturnValue(query);
  }
  const manager = {
    createQueryBuilder: jest.fn(() => query),
    existsBy: jest.fn(async () => goals > 0),
    find: jest.fn(async (entity: unknown) =>
      entity === ActivityDocumentEntity ? linked : documents,
    ),
    insert: jest.fn(async () => ({ identifiers: [{ id: 'act-1' }] })),
    findOneOrFail: jest.fn(async () => row),
    findOne: jest.fn(async () => activity),
    update: jest.fn(async () => undefined),
    delete: jest.fn(async () => undefined),
  };
  const recorder = { record: jest.fn(async () => undefined) };
  const activities = {
    find: jest.fn(async () => [row]),
    findOne: jest.fn(async () => row),
  };
  const repository = new ActivitiesRepositoryImpl(
    {
      transaction: (run: (m: EntityManager) => Promise<unknown>) =>
        run(manager as unknown as EntityManager),
    } as unknown as DataSource,
    activities as unknown as Repository<ActivityEntity>,
    recorder as unknown as TimelineRecorderService,
  );

  return { repository, query, manager, recorder, activities };
}

describe('ActivitiesRepositoryImpl', () => {
  it('cria com autoria, executores e o activity_suggested na mesma transação', async () => {
    const { repository, query, manager, recorder } = setup();

    const activity = await repository.create(input());

    expect(query.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(manager.insert).toHaveBeenCalledWith(ActivityEntity, {
      ...input().values,
      frequency: STORED_FREQUENCY,
      ptsId: 'pts-1',
      authorProfessionalId: 'prof-2',
      registeredByAccountId: 'acc-2',
    });
    expect(manager.insert).toHaveBeenCalledWith(ActivityDocumentEntity, [
      { activityId: 'act-1', documentId: 'doc-1' },
    ]);
    expect(query.relation).toHaveBeenCalledWith(ActivityEntity, 'executors');
    expect(query.add).toHaveBeenCalledWith(['prof-1']);
    expect(recorder.record).toHaveBeenCalledWith(
      {
        type: 'activity_suggested',
        targetType: 'activity',
        targetId: 'act-1',
        ptsId: 'pts-1',
        description: input().description,
        authorProfessionalId: 'prof-2',
        executedByAccountId: 'acc-2',
      },
      manager,
    );
    expect(activity).toEqual({
      id: 'act-1',
      ...input().values,
      executorProfessionalIds: ['prof-1'],
      documentIds: ['doc-1'],
      status: 'suggested',
      authorProfessionalId: 'prof-2',
      createdAt: '2026-12-01T13:00:00.000Z',
      updatedAt: null,
    });
  });

  it('refaz as checagens com o PTS travado e não grava nada na recusa', async () => {
    const missing = setup({ pts: null });
    const closed = setup({
      pts: { id: 'pts-1', status: PtsStateEnum.CANCELLED },
    });
    const goalGone = setup({ goals: 0 });
    const documentGone = setup({ documents: [] });

    await expectApiError(
      () => missing.repository.create(input()),
      404,
      'PTS_NOT_FOUND',
    );
    await expectApiError(
      () => closed.repository.create(input()),
      409,
      'PTS_NOT_EDITABLE',
    );
    await expectApiError(
      () => goalGone.repository.create(input()),
      400,
      'VALIDATION_ERROR',
    );
    await expectApiError(
      () => documentGone.repository.create(input()),
      400,
      'VALIDATION_ERROR',
    );
    expect(goalGone.manager.existsBy).toHaveBeenCalledWith(PtsGoalEntity, {
      id: 'goal-1',
      ptsId: 'pts-1',
    });

    for (const { manager, recorder } of [
      missing,
      closed,
      goalGone,
      documentGone,
    ]) {
      expect(manager.insert).not.toHaveBeenCalled();
      expect(recorder.record).not.toHaveBeenCalled();
    }
  });

  it('lista da mais recente para a mais antiga', async () => {
    const { repository, activities } = setup();

    const [activity] = await repository.findByPts('pts-1');

    expect(activities.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ptsId: 'pts-1' },
        order: { createdAt: 'DESC', id: 'DESC' },
      }),
    );
    expect(activity.frequency).toEqual(activityBody().frequency);
  });

  it('acha a atividade pelo id, com o PTS dela', async () => {
    const { repository, activities } = setup();

    expect(await repository.findById('act-1')).toMatchObject({
      id: 'act-1',
      ptsId: 'pts-1',
      authorProfessionalId: 'prof-2',
    });

    activities.findOne.mockResolvedValueOnce(null as never);
    expect(await repository.findById('act-x')).toBeNull();
  });

  it('edita, troca os documentos e grava activity_updated e activity_goal_unlinked na mesma transação', async () => {
    const { repository, query, manager, recorder } = setup({
      documents: [{ id: 'doc-1' }, { id: 'doc-3' }],
    });

    await repository.update(updateInput());

    expect(query.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(manager.findOne).toHaveBeenCalledWith(ActivityEntity, {
      where: { id: 'act-1', ptsId: 'pts-1' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(manager.update).toHaveBeenCalledWith(
      ActivityEntity,
      { id: 'act-1', ptsId: 'pts-1' },
      {
        ...updateInput().values,
        frequency: STORED_FREQUENCY,
        updatedAt: expect.any(Date),
      },
    );
    expect(manager.delete).toHaveBeenCalledWith(ActivityDocumentEntity, {
      activityId: 'act-1',
      documentId: In(['doc-2']),
    });
    expect(manager.insert).toHaveBeenCalledWith(ActivityDocumentEntity, [
      { activityId: 'act-1', documentId: 'doc-3' },
    ]);
    expect(recorder.record).toHaveBeenCalledTimes(2);
    expect(recorder.record).toHaveBeenNthCalledWith(
      1,
      {
        type: 'activity_updated',
        targetType: 'activity',
        targetId: 'act-1',
        ptsId: 'pts-1',
        description: updateInput().description,
        authorProfessionalId: 'prof-2',
        executedByAccountId: 'acc-2',
      },
      manager,
    );
    expect(recorder.record).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: 'activity_goal_unlinked',
        description: updateInput().goalUnlinkedDescription,
      }),
      manager,
    );
  });

  it('sem documentIds mantém os documentos; com a meta mantida, só activity_updated', async () => {
    const { repository, manager, recorder } = setup();

    await repository.update(
      updateInput({
        documentIds: undefined,
        values: { ...updateInput().values, goalId: 'goal-1' },
      }),
    );

    expect(manager.existsBy).not.toHaveBeenCalled();
    expect(manager.delete).not.toHaveBeenCalled();
    expect(manager.insert).not.toHaveBeenCalled();
    expect(recorder.record).toHaveBeenCalledTimes(1);
    expect(recorder.record).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'activity_updated' }),
      manager,
    );
  });

  it('refaz as checagens com o PTS e a atividade travados e não grava nada na recusa', async () => {
    const cases = [
      [setup({ activity: null }), updateInput(), 404, 'ACTIVITY_NOT_FOUND'],
      [
        setup({
          activity: { id: 'act-1', status: ActivityState.Archived },
        }),
        updateInput(),
        409,
        'ACTIVITY_NOT_EDITABLE',
      ],
      [
        setup({
          activity: { id: 'act-1', status: ActivityState.Running },
        }),
        updateInput(),
        403,
        'FORBIDDEN',
      ],
      [
        setup({
          pts: { id: 'pts-1', status: PtsStateEnum.CONCLUDED },
        }),
        updateInput(),
        409,
        'PTS_NOT_EDITABLE',
      ],
      [
        setup({ goals: 0 }),
        updateInput({
          values: { ...updateInput().values, goalId: 'goal-2' },
        }),
        400,
        'VALIDATION_ERROR',
      ],
      [
        setup({ documents: [{ id: 'doc-1' }] }),
        updateInput(),
        400,
        'VALIDATION_ERROR',
      ],
    ] as const;

    for (const [
      { repository, manager, recorder },
      data,
      status,
      code,
    ] of cases) {
      await expectApiError(() => repository.update(data), status, code);
      expect(manager.update).not.toHaveBeenCalled();
      expect(recorder.record).not.toHaveBeenCalled();
    }
  });
});
