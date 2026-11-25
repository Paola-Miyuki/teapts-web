import { jest } from '@jest/globals';
import { In, type DataSource, type EntityManager } from 'typeorm';

import { ActivityEntity } from '../../activities/entities/activity.entity';
import { ActivityState } from '../../activities/enums/activity.enums';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import { TimelineRecordType } from '../../timeline/enums/timeline-record-type.enum';
import type { TimelineRecorderService } from '../../timeline/services/timeline-recorder.service';
import { PtsGoalEntity } from '../entities/pts-goal.entity';
import { PtsEntity } from '../entities/pts.entity';
import { GoalOrigin, GoalStatus } from '../enums/goal.enums';
import { PtsNextVersionService } from '../services/pts-next-version.service';
import { expectApiError } from './test-utils';

const previous = (overrides: Partial<PtsEntity> = {}) => ({
  id: 'pts-1',
  patientId: 'patient-1',
  responsibleProfessionalId: 'prof-1',
  status: PtsStateEnum.RUNNING,
  version: 1,
  diagnosisSummary: 'Síntese',
  cid: 'F84.0',
  supportLevel: 2,
  strengths: 'Música',
  priorityNeeds: ['Comunicação'],
  socialSituation: 'Mora com a mãe',
  vulnerabilities: 'Vulnerabilidade',
  comorbidities: 'TDAH',
  sensoryProfile: 'Ruídos',
  communicationMethod: 'CAA',
  ...overrides,
});

const goal = (id: string, status: GoalStatus) => ({
  id,
  status,
  title: `Meta ${id}`,
  description: 'Descrição',
  area: 'social',
  measureCriterion: 'Critério',
  term: 'short',
  targetDate: '2026-12-01',
});

const activity = (id: string, goalId: string | null) => ({
  id,
  goalId,
  title: `Atividade ${id}`,
  description: 'Como',
  type: 'other',
  specialism: 'doctor',
  frequency: { quantity: 1, period: 'weekly', duration_minutes: 45 },
  modality: 'in_person',
  visitPlace: null,
  executor: 'team',
  authorProfessionalId: 'prof-2',
});

const actor = {
  accountId: 'acc-1',
  professionalId: 'prof-1',
  name: 'Ana Souza',
};

function setup({
  pts = previous() as unknown,
  hasDraft = false,
  maxVersion = 1,
} = {}) {
  const ptsQuery = {
    setLock: jest.fn(),
    where: jest.fn(),
    getOne: jest.fn(async () => pts),
  };
  ptsQuery.setLock.mockReturnValue(ptsQuery);
  ptsQuery.where.mockReturnValue(ptsQuery);

  let goalsInserted = 0;
  let activitiesInserted = 0;
  const manager = {
    createQueryBuilder: jest.fn(() => ptsQuery),
    existsBy: jest.fn(async () => hasDraft),
    query: jest.fn(async (sql: string) =>
      sql.includes('MAX(version)') ? [{ max: maxVersion }] : [],
    ),
    find: jest.fn(async (entity: unknown) =>
      entity === PtsGoalEntity
        ? [
            goal('g-partial', GoalStatus.PartiallyAchieved),
            goal('g-not', GoalStatus.NotAchieved),
          ]
        : [
            activity('a-kept', 'g-partial'),
            activity('a-achieved', 'g-achieved'),
            activity('a-none', null),
          ],
    ),
    insert: jest.fn<
      (
        entity: unknown,
        values: unknown,
      ) => Promise<{ identifiers: { id: string }[] }>
    >(async (entity: unknown) => ({
      identifiers: [
        {
          id:
            entity === PtsEntity
              ? 'pts-2'
              : entity === PtsGoalEntity
                ? `new-goal-${++goalsInserted}`
                : `new-act-${++activitiesInserted}`,
        },
      ],
    })),
  };
  const dataSource = {
    transaction: jest.fn((run: (m: EntityManager) => Promise<unknown>) =>
      run(manager as unknown as EntityManager),
    ),
  };
  const recorder = { record: jest.fn(async () => undefined) };
  const service = new PtsNextVersionService(
    dataSource as unknown as DataSource,
    recorder as unknown as TimelineRecorderService,
  );
  const inserted = (entity: unknown) =>
    manager.insert.mock.calls
      .filter(([target]) => target === entity)
      .map(([, values]) => values);

  return { service, manager, recorder, dataSource, inserted };
}

describe('PtsNextVersionService (RFPTS013)', () => {
  it('cria o draft ligado ao anterior, com a versão seguinte e a ficha copiada', async () => {
    const { service, manager, inserted } = setup({ maxVersion: 3 });

    expect(
      await service.createNextVersion('pts-1', '2026-12-15', actor),
    ).toEqual({ id: 'pts-2', version: 4 });
    expect(inserted(PtsEntity)).toEqual([
      {
        patientId: 'patient-1',
        responsibleProfessionalId: 'prof-1',
        status: PtsStateEnum.DRAFT,
        version: 4,
        previousPtsId: 'pts-1',
        caseStudyDate: '2026-12-15',
        nextReviewAt: '2027-12-15',
        diagnosisSummary: 'Síntese',
        cid: 'F84.0',
        supportLevel: 2,
        strengths: 'Música',
        priorityNeeds: ['Comunicação'],
        socialSituation: 'Mora com a mãe',
        vulnerabilities: 'Vulnerabilidade',
        comorbidities: 'TDAH',
        sensoryProfile: 'Ruídos',
        communicationMethod: 'CAA',
      },
    ]);
    expect(
      manager.query.mock.calls.some(
        ([sql]) =>
          sql.includes('professional_participating_on_therapeutic_journey') &&
          sql.includes('SELECT'),
      ),
    ).toBe(true);
  });

  it('copia só as metas parciais e as não atingidas, sem prazo nem data-alvo', async () => {
    const { service, manager, inserted } = setup();

    await service.createNextVersion('pts-1', '2026-12-15', actor);

    expect(manager.find).toHaveBeenCalledWith(
      PtsGoalEntity,
      expect.objectContaining({
        where: {
          ptsId: 'pts-1',
          status: In([GoalStatus.PartiallyAchieved, GoalStatus.NotAchieved]),
        },
      }),
    );
    const copy = {
      ptsId: 'pts-2',
      description: 'Descrição',
      area: 'social',
      measureCriterion: 'Critério',
      term: null,
      targetDate: null,
      authorProfessionalId: 'prof-1',
      registeredByAccountId: 'acc-1',
    };
    expect(inserted(PtsGoalEntity)).toEqual([
      {
        ...copy,
        title: 'Meta g-partial',
        origin: GoalOrigin.KeptPartial,
        previousGoalId: 'g-partial',
      },
      {
        ...copy,
        title: 'Meta g-not',
        origin: GoalOrigin.KeptNotAchieved,
        previousGoalId: 'g-not',
      },
    ]);
  });

  it('copia as atividades em andamento como sugeridas, religando as metas', async () => {
    const { service, manager, inserted } = setup();

    await service.createNextVersion('pts-1', '2026-12-15', actor);

    expect(manager.find).toHaveBeenCalledWith(
      ActivityEntity,
      expect.objectContaining({
        where: { ptsId: 'pts-1', status: ActivityState.Running },
      }),
    );
    const copies = inserted(ActivityEntity) as Record<string, unknown>[];
    expect(copies.map(({ goalId }) => goalId)).toEqual([
      'new-goal-1',
      null,
      null,
    ]);
    expect(copies[0]).toEqual({
      ptsId: 'pts-2',
      title: 'Atividade a-kept',
      description: 'Como',
      type: 'other',
      specialism: 'doctor',
      frequency: { quantity: 1, period: 'weekly', duration_minutes: 45 },
      modality: 'in_person',
      visitPlace: null,
      executor: 'team',
      goalId: 'new-goal-1',
      authorProfessionalId: 'prof-2',
      registeredByAccountId: 'acc-1',
    });
    const links = manager.query.mock.calls.map(([sql]) => sql).join('\n');
    expect(links).toContain('activity_executor');
    expect(links).toContain('activity_document');
  });

  it('registra next_version_created na timeline do PTS anterior', async () => {
    const { service, recorder, manager } = setup();

    await service.createNextVersion('pts-1', '2026-12-15', actor);

    expect(recorder.record).toHaveBeenCalledWith(
      {
        type: TimelineRecordType.NextVersionCreated,
        targetType: 'pts',
        targetId: 'pts-2',
        ptsId: 'pts-1',
        description: 'Ana Souza criou o rascunho do PTS v2',
        authorProfessionalId: 'prof-1',
        executedByAccountId: 'acc-1',
      },
      manager,
    );
  });

  it('usa a transação de quem chama', async () => {
    const { service, dataSource, manager } = setup();

    await service.createNextVersion(
      'pts-1',
      '2026-12-15',
      actor,
      manager as unknown as EntityManager,
    );

    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(manager.insert).toHaveBeenCalled();
  });

  it.each([
    ['PTS inexistente', { pts: null }, 404, 'PTS_NOT_FOUND'],
    [
      'PTS fora de running',
      { pts: previous({ status: PtsStateEnum.CONCLUDED }) },
      409,
      'PTS_NOT_RUNNING',
    ],
    [
      'paciente já tem rascunho (RN011)',
      { hasDraft: true },
      409,
      'DRAFT_ALREADY_EXISTS',
    ],
  ])('recusa: %s', async (_name, options, status, code) => {
    const { service, manager } = setup(options);

    await expectApiError(
      () => service.createNextVersion('pts-1', '2026-12-15', actor),
      status,
      code,
    );
    expect(manager.insert).not.toHaveBeenCalled();
  });
});
