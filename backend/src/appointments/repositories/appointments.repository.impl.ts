import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { activityNotFound } from '../../activities/activities.errors';
import { ActivityEntity } from '../../activities/entities/activity.entity';
import { PtsEntity } from '../../pts/entities/pts.entity';
import { ptsNotFound } from '../../pts/pts.errors';
import { TimelineRecordTarget } from '../../timeline/enums/timeline-record-target.enum';
import { TimelineRecordType } from '../../timeline/enums/timeline-record-type.enum';
import { TimelineRecorderService } from '../../timeline/services/timeline-recorder.service';
import { assertReceivesAppointment } from '../appointment-rules';
import type { AppointmentResponseDto } from '../dto/appointment-response.dto';
import { AppointmentEntity } from '../entities/appointment.entity';
import {
  AppointmentsRepository,
  type CreateAppointmentInput,
} from './appointments.repository';

@Injectable()
export class AppointmentsRepositoryImpl extends AppointmentsRepository {
  constructor(
    private readonly dataSource: DataSource,
    private readonly timelineRecorder: TimelineRecorderService,
  ) {
    super();
  }

  async create(input: CreateAppointmentInput): Promise<AppointmentResponseDto> {
    const { ptsId, activityId } = input;

    return this.dataSource.transaction(async (manager) => {
      // Trava o PTS e a atividade, nesta ordem como nas outras operações, e
      // refaz a checagem: encerrar, suspender ou concluir ao mesmo tempo não passa.
      const pts = await manager
        .createQueryBuilder(PtsEntity, 'pts')
        .setLock('pessimistic_write')
        .where('pts.id = :id', { id: ptsId })
        .getOne();

      if (!pts) {
        throw ptsNotFound();
      }

      const activity = await manager.findOne(ActivityEntity, {
        where: { id: activityId, ptsId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!activity) {
        throw activityNotFound();
      }

      assertReceivesAppointment(pts.status, activity.status);

      const { identifiers } = await manager.insert(AppointmentEntity, {
        ...input.values,
        activityId,
        authorProfessionalId: input.authorProfessionalId,
        registeredByAccountId: input.executedByAccountId,
      });
      const { id } = identifiers[0] as { id: string };

      await this.timelineRecorder.record(
        {
          type: TimelineRecordType.AppointmentRegistered,
          targetType: TimelineRecordTarget.Appointment,
          targetId: id,
          ptsId,
          description: input.description,
          authorProfessionalId: input.authorProfessionalId,
          executedByAccountId: input.executedByAccountId,
        },
        manager,
      );

      const appointment = await manager.findOneByOrFail(AppointmentEntity, {
        id,
      });

      return {
        id,
        activityId: appointment.activityId,
        attendance: appointment.attendance,
        appointmentDate: appointment.appointmentDate,
        createdAt: appointment.createdAt.toISOString(),
      };
    });
  }
}
