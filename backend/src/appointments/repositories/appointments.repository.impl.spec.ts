import { jest } from '@jest/globals';
import type { DataSource, EntityManager } from 'typeorm';

import { ActivityEntity } from '../../activities/entities/activity.entity';
import {
  ActivityModality,
  ActivityState,
} from '../../activities/enums/activity.enums';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import { expectApiError } from '../../pts/__tests__/test-utils';
import type { TimelineRecorderService } from '../../timeline/services/timeline-recorder.service';
import { AppointmentEntity } from '../entities/appointment.entity';
import { Attendance } from '../enums/attendance.enum';
import { AppointmentsRepositoryImpl } from './appointments.repository.impl';
import type { CreateAppointmentInput } from './appointments.repository';

const input = (): CreateAppointmentInput => ({
  ptsId: 'pts-1',
  activityId: 'act-1',
  values: {
    appointmentDate: '2026-12-03',
    startTime: '14:00',
    endTime: '14:45',
    modality: ActivityModality.InPerson,
    visitPlace: null,
    attendance: Attendance.Done,
    soapSubjective: 'S',
    soapObjective: 'O',
    soapAssessment: 'A',
    soapPlan: 'P',
    absenceReason: null,
  },
  authorProfessionalId: 'prof-2',
  executedByAccountId: 'acc-2',
  description: 'João Lima registrou',
});

function setup({
  pts = { status: PtsStateEnum.RUNNING } as { status: PtsStateEnum } | null,
  activity = { status: ActivityState.Running } as {
    status: ActivityState;
  } | null,
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
    findOne: jest.fn(async () => activity),
    insert: jest.fn(async () => ({ identifiers: [{ id: 'app-1' }] })),
    findOneByOrFail: jest.fn(async () => ({
      id: 'app-1',
      activityId: 'act-1',
      attendance: 'done',
      appointmentDate: '2026-12-03',
      createdAt: new Date('2026-12-03T17:50:00.000Z'),
    })),
  };
  const recorder = { record: jest.fn(async () => undefined) };
  const repository = new AppointmentsRepositoryImpl(
    {
      transaction: (run: (m: EntityManager) => Promise<unknown>) =>
        run(manager as unknown as EntityManager),
    } as unknown as DataSource,
    recorder as unknown as TimelineRecorderService,
  );

  return { repository, manager, recorder, query };
}

describe('AppointmentsRepositoryImpl.create (RFACT004)', () => {
  it('grava com autoria e o appointment_registered na mesma transação', async () => {
    const { repository, manager, recorder, query } = setup();

    expect(await repository.create(input())).toEqual({
      id: 'app-1',
      activityId: 'act-1',
      attendance: 'done',
      appointmentDate: '2026-12-03',
      createdAt: '2026-12-03T17:50:00.000Z',
    });
    expect(query.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(manager.findOne).toHaveBeenCalledWith(ActivityEntity, {
      where: { id: 'act-1', ptsId: 'pts-1' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(manager.insert).toHaveBeenCalledWith(AppointmentEntity, {
      ...input().values,
      activityId: 'act-1',
      authorProfessionalId: 'prof-2',
      registeredByAccountId: 'acc-2',
    });
    expect(recorder.record).toHaveBeenCalledWith(
      {
        type: 'appointment_registered',
        targetType: 'appointment',
        targetId: 'app-1',
        ptsId: 'pts-1',
        description: 'João Lima registrou',
        authorProfessionalId: 'prof-2',
        executedByAccountId: 'acc-2',
      },
      manager,
    );
  });

  it.each([
    [
      'a atividade deixou de estar em andamento',
      { activity: { status: ActivityState.Suspended } },
      409,
      'ACTIVITY_NOT_RUNNING',
    ],
    ['a atividade sumiu', { activity: null }, 404, 'ACTIVITY_NOT_FOUND'],
    [
      'o PTS foi encerrado',
      { pts: { status: PtsStateEnum.CONCLUDED } },
      409,
      'PTS_NOT_ACTIVE',
    ],
    ['o PTS sumiu', { pts: null }, 404, 'PTS_NOT_FOUND'],
  ])('refaz as checagens travado: %s', async (_name, state, status, code) => {
    const { repository, manager, recorder } = setup(state);

    await expectApiError(() => repository.create(input()), status, code);
    expect(manager.insert).not.toHaveBeenCalled();
    expect(recorder.record).not.toHaveBeenCalled();
  });
});
