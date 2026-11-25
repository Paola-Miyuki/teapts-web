import { jest } from '@jest/globals';
import type { DataSource, EntityManager } from 'typeorm';

import { ActivityModality } from '../../activities/enums/activity.enums';
import { expectApiError } from '../../pts/__tests__/test-utils';
import type { TimelineRecorderService } from '../../timeline/services/timeline-recorder.service';
import { AppointmentEntity } from '../entities/appointment.entity';
import { Attendance } from '../enums/attendance.enum';
import { AppointmentsRepositoryImpl } from './appointments.repository.impl';
import type { RectifyAppointmentInput } from './appointments.repository';

const input = (): RectifyAppointmentInput => ({
  ptsId: 'pts-1',
  appointmentId: 'app-1',
  values: {
    appointmentDate: '2026-12-03',
    startTime: '14:00',
    endTime: '14:50',
    modality: ActivityModality.InPerson,
    visitPlace: null,
    attendance: Attendance.Done,
    soapSubjective: 'S',
    soapObjective: 'O',
    soapAssessment: 'A',
    soapPlan: 'P',
    absenceReason: null,
  },
  reason: 'Horário de término registrado errado.',
  authorProfessionalId: 'prof-2',
  executedByAccountId: 'acc-2',
  description: 'João Lima retificou',
});

function setup(original: { id: string; activityId: string } | null) {
  const manager = {
    findOne: jest.fn(async () => original),
    insert: jest.fn(async () => ({ identifiers: [{ id: 'app-2' }] })),
    findOneByOrFail: jest.fn(async () => ({
      id: 'app-2',
      createdAt: new Date('2026-12-04T12:00:00.000Z'),
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

  return { repository, manager, recorder };
}

describe('AppointmentsRepositoryImpl.rectify (RFACT007)', () => {
  it('grava um novo registro ligado ao original e o appointment_rectified', async () => {
    const { repository, manager, recorder } = setup({
      id: 'app-1',
      activityId: 'act-1',
    });

    expect(await repository.rectify(input())).toEqual({
      id: 'app-2',
      rectifiesAppointmentId: 'app-1',
      createdAt: '2026-12-04T12:00:00.000Z',
    });
    expect(manager.findOne).toHaveBeenCalledWith(AppointmentEntity, {
      where: { id: 'app-1' },
      lock: { mode: 'pessimistic_write' },
    });
    // O original não é atualizado: só existe o insert (RN020).
    expect(manager.insert).toHaveBeenCalledTimes(1);
    expect(manager.insert).toHaveBeenCalledWith(AppointmentEntity, {
      ...input().values,
      activityId: 'act-1',
      authorProfessionalId: 'prof-2',
      registeredByAccountId: 'acc-2',
      rectifiesAppointmentId: 'app-1',
      rectificationReason: 'Horário de término registrado errado.',
    });
    expect(recorder.record).toHaveBeenCalledWith(
      {
        type: 'appointment_rectified',
        targetType: 'appointment',
        targetId: 'app-2',
        ptsId: 'pts-1',
        description: 'João Lima retificou',
        authorProfessionalId: 'prof-2',
        executedByAccountId: 'acc-2',
      },
      manager,
    );
  });

  it('responde 404 se o original sumiu', async () => {
    const { repository, manager, recorder } = setup(null);

    await expectApiError(
      () => repository.rectify(input()),
      404,
      'APPOINTMENT_NOT_FOUND',
    );
    expect(manager.insert).not.toHaveBeenCalled();
    expect(recorder.record).not.toHaveBeenCalled();
  });
});
