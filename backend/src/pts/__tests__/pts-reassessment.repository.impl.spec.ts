import { jest } from '@jest/globals';
import { In, type DataSource, type EntityManager } from 'typeorm';

import { ActivityEntity } from '../../activities/entities/activity.entity';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import type { TimelineRecorderService } from '../../timeline/services/timeline-recorder.service';
import { PtsGoalEntity } from '../entities/pts-goal.entity';
import { PtsEntity } from '../entities/pts.entity';
import { GoalStatus } from '../enums/goal.enums';
import { PtsReassessmentRepositoryImpl } from '../repositories/pts-reassessment.repository.impl';
import type { RegisterReassessmentInput } from '../repositories/pts-reassessment.repository';
import type { PtsNextVersionService } from '../services/pts-next-version.service';
import { expectApiError } from './test-utils';

const actor = {
  accountId: 'acc-1',
  professionalId: 'prof-1',
  name: 'Ana Souza',
};

const input = (
  overrides: Partial<RegisterReassessmentInput> = {},
): RegisterReassessmentInput => ({
  ptsId: 'pts-1',
  meetingDate: '2026-12-15',
  goals: [
    { goalId: 'goal-1', status: GoalStatus.Achieved, note: null },
    {
      goalId: 'goal-2',
      status: GoalStatus.PartiallyAchieved,
      note: 'Conversa 2 vezes por semana.',
    },
  ],
  createNextVersion: true,
  reason: 'Metas revistas.',
  actor,
  ...overrides,
});

function setup({
  pts = {
    id: 'pts-1',
    status: PtsStateEnum.RUNNING,
    responsibleProfessionalId: 'prof-1',
  } as Partial<PtsEntity> | null,
  goals = [
    { id: 'goal-1', status: GoalStatus.InProgress },
    { id: 'goal-2', status: GoalStatus.InProgress },
  ],
  activities = [{ id: 'act-1', title: 'Integração sensorial' }],
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
    find: jest.fn(async (entity: unknown) =>
      entity === PtsGoalEntity ? goals : activities,
    ),
    update: jest.fn(async () => undefined),
  };
  const recorder = { record: jest.fn(async () => undefined) };
  const nextVersion = {
    createNextVersion: jest.fn(async () => ({ id: 'pts-2', version: 2 })),
  };
  const repository = new PtsReassessmentRepositoryImpl(
    {
      transaction: (run: (m: EntityManager) => Promise<unknown>) =>
        run(manager as unknown as EntityManager),
    } as unknown as DataSource,
    recorder as unknown as TimelineRecorderService,
    nextVersion as unknown as PtsNextVersionService,
  );
  const types = () =>
    recorder.record.mock.calls.map(
      (call) => (call as unknown as [{ type: string }])[0].type,
    );

  return { repository, query, manager, recorder, nextVersion, types };
}

describe('PtsReassessmentRepositoryImpl (RFEVA005)', () => {
  it('grava metas, data, próxima versão, conclusão e eventos na mesma transação', async () => {
    const { repository, query, manager, recorder, nextVersion, types } =
      setup();

    expect(await repository.register(input())).toEqual({
      id: 'pts-1',
      status: 'concluded',
      reassessedAt: '2026-12-15',
      nextPtsId: 'pts-2',
    });

    expect(query.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(manager.update).toHaveBeenCalledWith(
      PtsGoalEntity,
      { id: 'goal-2', ptsId: 'pts-1' },
      {
        status: 'partially_achieved',
        resultNote: 'Conversa 2 vezes por semana.',
        resultRecordedAt: expect.any(Date),
        resultRecordedByAccountId: 'acc-1',
        updatedAt: expect.any(Date),
      },
    );
    expect(manager.update).toHaveBeenCalledWith(PtsEntity, 'pts-1', {
      reassessedAt: '2026-12-15',
      reassessedByAccountId: 'acc-1',
    });
    expect(nextVersion.createNextVersion).toHaveBeenCalledWith(
      'pts-1',
      '2026-12-15',
      actor,
      manager,
    );
    expect(manager.update).toHaveBeenCalledWith(PtsEntity, 'pts-1', {
      status: 'concluded',
      concludedAt: expect.any(Date),
      closingDate: '2026-12-15',
      closingReason: 'Metas revistas.',
      closedByAccountId: 'acc-1',
    });
    expect(manager.update).toHaveBeenCalledWith(
      ActivityEntity,
      { id: In(['act-1']) },
      {
        status: 'concluded',
        statusChangedByAccountId: 'acc-1',
        updatedAt: expect.any(Date),
        concludedAt: expect.any(Date),
      },
    );
    expect(types()).toEqual([
      'pts_reassessed',
      'pts_concluded',
      'activity_concluded',
    ]);
    expect(recorder.record).toHaveBeenCalledWith(
      {
        type: 'pts_concluded',
        targetType: 'pts',
        targetId: 'pts-1',
        description: 'Ana Souza concluiu o PTS (Metas revistas.)',
        ptsId: 'pts-1',
        authorProfessionalId: 'prof-1',
        executedByAccountId: 'acc-1',
      },
      manager,
    );
  });

  it('cria a próxima versão antes de concluir o PTS', async () => {
    const { repository, manager, nextVersion } = setup();

    await repository.register(input());

    const concludeCall = manager.update.mock.calls.findIndex(
      (call) =>
        (call as unknown[])[0] === PtsEntity &&
        'status' in ((call as unknown[])[2] as object),
    );
    expect(
      nextVersion.createNextVersion.mock.invocationCallOrder[0],
    ).toBeLessThan(manager.update.mock.invocationCallOrder[concludeCall]);
  });

  it('"Encerrar sem novo PTS" só conclui; o admin age mesmo sem ser o responsável', async () => {
    const { repository, manager, nextVersion, types } = setup({
      pts: {
        id: 'pts-1',
        status: PtsStateEnum.RUNNING,
        responsibleProfessionalId: 'prof-9',
      },
      activities: [],
    });

    expect(
      await repository.register(
        input({
          createNextVersion: false,
          reason: null,
          actor: { accountId: 'acc-admin', professionalId: null, name: 'Kaio' },
        }),
      ),
    ).toMatchObject({ nextPtsId: null });
    expect(nextVersion.createNextVersion).not.toHaveBeenCalled();
    expect(manager.update).not.toHaveBeenCalledWith(
      ActivityEntity,
      expect.anything(),
      expect.anything(),
    );
    expect(types()).toEqual(['pts_reassessed', 'pts_concluded']);
  });

  it('refaz as checagens com o PTS travado e não grava nada na recusa', async () => {
    const cases = [
      [setup({ pts: null }), 404, 'PTS_NOT_FOUND'],
      [
        setup({
          pts: {
            id: 'pts-1',
            status: PtsStateEnum.RUNNING,
            responsibleProfessionalId: 'prof-9',
          },
        }),
        403,
        'FORBIDDEN',
      ],
      [
        setup({
          pts: {
            id: 'pts-1',
            status: PtsStateEnum.CONCLUDED,
            responsibleProfessionalId: 'prof-1',
          },
        }),
        409,
        'PTS_NOT_RUNNING',
      ],
      [
        setup({
          goals: [
            { id: 'goal-1', status: GoalStatus.InProgress },
            { id: 'goal-2', status: GoalStatus.InProgress },
            { id: 'goal-3', status: GoalStatus.InProgress },
          ],
        }),
        400,
        'GOALS_WITHOUT_RESULT',
      ],
    ] as const;

    for (const [
      { repository, manager, recorder, nextVersion },
      status,
      code,
    ] of cases) {
      await expectApiError(() => repository.register(input()), status, code);
      expect(manager.update).not.toHaveBeenCalled();
      expect(recorder.record).not.toHaveBeenCalled();
      expect(nextVersion.createNextVersion).not.toHaveBeenCalled();
    }
  });
});
