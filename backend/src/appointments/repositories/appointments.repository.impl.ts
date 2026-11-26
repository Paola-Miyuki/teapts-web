import { Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';

import { Account } from '../../accounts/entities/account.entity';
import { activityNotFound } from '../../activities/activities.errors';
import { ActivityEntity } from '../../activities/entities/activity.entity';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import { Professional } from '../../professionals/entities/professional.entity';
import { PtsEntity } from '../../pts/entities/pts.entity';
import { ptsNotFound } from '../../pts/pts.errors';
import { TimelineRecordTarget } from '../../timeline/enums/timeline-record-target.enum';
import { TimelineRecordType } from '../../timeline/enums/timeline-record-type.enum';
import { TimelineRecorderService } from '../../timeline/services/timeline-recorder.service';
import { assertReceivesAppointment } from '../appointment-rules';
import { appointmentNotFound } from '../appointments.errors';
import type { AppointmentResponseDto } from '../dto/appointment-response.dto';
import type { RectifyAppointmentResponseDto } from '../dto/rectify-appointment.dto';
import { AppointmentEntity } from '../entities/appointment.entity';
import {
  AppointmentsRepository,
  type CreateAppointmentInput,
  type FindAppointmentsInput,
  type FindAppointmentsResult,
  type RectifyAppointmentInput,
  type StoredAppointment,
} from './appointments.repository';

function displayName(account?: Pick<Account, 'name' | 'socialName'> | null) {
  return account ? account.socialName?.trim() || account.name : '';
}

// O Postgres devolve a hora como HH:mm:ss; a API usa HH:mm.
function toTime(value: string): string;
function toTime(value: string | null): string | null;
function toTime(value: string | null) {
  return value ? value.slice(0, 5) : null;
}

const unique = (values: (string | null)[]) => [
  ...new Set(values.filter((value): value is string => Boolean(value))),
];

// Equipe de um PTS não rejeitado (RN016): responsável ou membro.
const TEAM_PTS = `(pts.status <> :rejected AND (pts.responsibleProfessionalId IN (:...ownProfessionalIds) OR pts.id IN (SELECT member.therapeutic_journey_id FROM professional_participating_on_therapeutic_journey member WHERE member.professional_id IN (:...ownProfessionalIds))))`;

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

  async findMany(
    input: FindAppointmentsInput,
  ): Promise<FindAppointmentsResult> {
    const query = this.dataSource.manager
      .createQueryBuilder(AppointmentEntity, 'appointment')
      .innerJoin(
        ActivityEntity,
        'activity',
        'activity.id = appointment.activityId',
      )
      .innerJoin(PtsEntity, 'pts', 'pts.id = activity.ptsId')
      // A retificação aparece dentro do original, não como outra linha (RN020).
      .where('appointment.rectifiesAppointmentId IS NULL');

    if (input.scope) {
      const { patientId, professionalIds } = input.scope;
      const visible: string[] = [];

      if (patientId) {
        visible.push('pts.patientId = :ownPatientId');
      }

      if (professionalIds.length > 0) {
        visible.push(TEAM_PTS);
      }

      query.andWhere(
        visible.length > 0 ? `(${visible.join(' OR ')})` : 'FALSE',
        {
          ownPatientId: patientId,
          ownProfessionalIds: professionalIds,
          rejected: PtsStateEnum.REJECTED,
        },
      );
    }

    if (input.patientId) {
      query.andWhere('pts.patientId = :patientId', {
        patientId: input.patientId,
      });
    }

    if (input.ptsId) {
      query.andWhere('activity.ptsId = :ptsId', { ptsId: input.ptsId });
    }

    if (input.activityId) {
      query.andWhere('appointment.activityId = :activityId', {
        activityId: input.activityId,
      });
    }

    if (input.authorId) {
      query.andWhere('appointment.authorProfessionalId = :authorId', {
        authorId: input.authorId,
      });
    }

    if (input.attendance?.length) {
      query.andWhere('appointment.attendance IN (:...attendance)', {
        attendance: input.attendance,
      });
    }

    if (input.specialism?.length) {
      query.andWhere('activity.specialism IN (:...specialism)', {
        specialism: input.specialism,
      });
    }

    if (input.modality?.length) {
      query.andWhere('appointment.modality IN (:...modality)', {
        modality: input.modality,
      });
    }

    if (input.from) {
      query.andWhere('appointment.appointmentDate >= :from', {
        from: input.from,
      });
    }

    if (input.to) {
      query.andWhere('appointment.appointmentDate <= :to', { to: input.to });
    }

    const order = input.order === 'asc' ? 'ASC' : 'DESC';

    // Cada atendimento tem uma atividade e um PTS: o join não repete linhas.
    const [appointments, total] = await query
      .orderBy('appointment.appointmentDate', order)
      .addOrderBy('appointment.startTime', order)
      .addOrderBy('appointment.createdAt', order)
      .addOrderBy('appointment.id', order)
      .offset((input.page - 1) * input.limit)
      .limit(input.limit)
      .getManyAndCount();

    return { rows: await this.hydrate(appointments), total };
  }

  async findById(id: string): Promise<StoredAppointment | null> {
    const appointment = await this.dataSource.manager.findOneBy(
      AppointmentEntity,
      { id },
    );

    if (!appointment) {
      return null;
    }

    const [stored] = await this.hydrate([appointment]);

    return stored ?? null;
  }

  async findRectifications(id: string): Promise<StoredAppointment[]> {
    const rectifications = await this.dataSource.manager.find(
      AppointmentEntity,
      {
        where: { rectifiesAppointmentId: id },
        order: { createdAt: 'ASC', id: 'ASC' },
      },
    );

    return this.hydrate(rectifications);
  }

  async rectify(
    input: RectifyAppointmentInput,
  ): Promise<RectifyAppointmentResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      // Trava o original: duas retificações ao mesmo tempo entram em ordem.
      const original = await manager.findOne(AppointmentEntity, {
        where: { id: input.appointmentId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!original) {
        throw appointmentNotFound();
      }

      // O original não muda: a correção é um novo registro (RN020).
      const { identifiers } = await manager.insert(AppointmentEntity, {
        ...input.values,
        activityId: original.activityId,
        authorProfessionalId: input.authorProfessionalId,
        registeredByAccountId: input.executedByAccountId,
        rectifiesAppointmentId: original.id,
        rectificationReason: input.reason,
      });
      const { id } = identifiers[0] as { id: string };

      await this.timelineRecorder.record(
        {
          type: TimelineRecordType.AppointmentRectified,
          targetType: TimelineRecordTarget.Appointment,
          targetId: id,
          ptsId: input.ptsId,
          description: input.description,
          authorProfessionalId: input.authorProfessionalId,
          executedByAccountId: input.executedByAccountId,
        },
        manager,
      );

      const rectification = await manager.findOneByOrFail(AppointmentEntity, {
        id,
      });

      return {
        id,
        rectifiesAppointmentId: original.id,
        createdAt: rectification.createdAt.toISOString(),
      };
    });
  }

  // Busca de uma vez a atividade, o PTS, os nomes e as retificações.
  private async hydrate(
    appointments: AppointmentEntity[],
  ): Promise<StoredAppointment[]> {
    if (appointments.length === 0) {
      return [];
    }

    const { manager } = this.dataSource;
    const activities = await manager.find(ActivityEntity, {
      where: { id: In(unique(appointments.map((item) => item.activityId))) },
      select: { id: true, ptsId: true, title: true, specialism: true },
      loadEagerRelations: false,
    });
    const activitiesById = new Map(activities.map((item) => [item.id, item]));

    const ptsList = await manager.find(PtsEntity, {
      where: { id: In(unique(activities.map((item) => item.ptsId))) },
      select: { id: true, version: true, patientId: true },
      loadEagerRelations: false,
      withDeleted: true,
    });
    const ptsById = new Map(ptsList.map((item) => [item.id, item]));

    const authorIds = unique(
      appointments.map((item) => item.authorProfessionalId),
    );
    const authors =
      authorIds.length > 0
        ? await manager.find(Professional, {
            where: { id: In(authorIds) },
            relations: { account: true },
            select: {
              id: true,
              specialism: true,
              account: { id: true, name: true, socialName: true },
            },
            loadEagerRelations: false,
          })
        : [];
    const authorsById = new Map(authors.map((item) => [item.id, item]));

    const accounts = await manager.find(Account, {
      where: {
        id: In(
          unique([
            ...ptsList.map((item) => item.patientId),
            ...appointments.map((item) => item.registeredByAccountId),
          ]),
        ),
      },
      select: { id: true, name: true, socialName: true },
      loadEagerRelations: false,
    });
    const accountsById = new Map(accounts.map((item) => [item.id, item]));

    const originalIds = appointments
      .filter((item) => !item.rectifiesAppointmentId)
      .map((item) => item.id);
    const rectified = new Set(
      originalIds.length > 0
        ? (
            await manager
              .createQueryBuilder(AppointmentEntity, 'rectification')
              .select('rectification.rectifiesAppointmentId', 'id')
              .where('rectification.rectifiesAppointmentId IN (:...ids)', {
                ids: originalIds,
              })
              .getRawMany<{ id: string }>()
          ).map(({ id }) => id)
        : [],
    );

    return appointments.flatMap((appointment) => {
      const activity = activitiesById.get(appointment.activityId);
      const pts = activity ? ptsById.get(activity.ptsId) : undefined;

      if (!activity || !pts) {
        return [];
      }

      const author = appointment.authorProfessionalId
        ? authorsById.get(appointment.authorProfessionalId)
        : undefined;

      return [
        {
          id: appointment.id,
          ptsId: pts.id,
          appointmentDate: appointment.appointmentDate,
          startTime: toTime(appointment.startTime),
          endTime: toTime(appointment.endTime),
          modality: appointment.modality,
          visitPlace: appointment.visitPlace,
          attendance: appointment.attendance,
          soapSubjective: appointment.soapSubjective,
          soapObjective: appointment.soapObjective,
          soapAssessment: appointment.soapAssessment,
          soapPlan: appointment.soapPlan,
          absenceReason: appointment.absenceReason,
          rectifiesAppointmentId: appointment.rectifiesAppointmentId,
          rectificationReason: appointment.rectificationReason,
          patient: {
            id: pts.patientId,
            name: displayName(accountsById.get(pts.patientId)),
          },
          pts: { id: pts.id, version: pts.version },
          activity: {
            id: activity.id,
            title: activity.title,
            specialism: activity.specialism,
          },
          author: author
            ? {
                id: author.id,
                name: displayName(author.account),
                specialism: author.specialism,
              }
            : null,
          registeredBy: {
            id: appointment.registeredByAccountId,
            name: displayName(
              accountsById.get(appointment.registeredByAccountId),
            ),
          },
          rectified: rectified.has(appointment.id),
          createdAt: appointment.createdAt.toISOString(),
        },
      ];
    });
  }
}
