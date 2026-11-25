import { Injectable } from '@nestjs/common';

import type { AccountContext } from '../../accounts/services/accounts.service';
import {
  activityNotFound,
  missingVisitPlace,
} from '../../activities/activities.errors';
import { ActivityModality } from '../../activities/enums/activity.enums';
import { ActivitiesRepository } from '../../activities/repositories/activities.repository';
import { isAdmin } from '../../auth/account-context';
import { REVIEW_TIME_ZONE } from '../../notifications/services/review-window.service';
import { ownTeamProfile, teamIds } from '../../pts/pts-access';
import { ptsNotFound } from '../../pts/pts.errors';
import { PtsGoalsRepository } from '../../pts/repositories/pts-goals.repository';
import { assertReceivesAppointment } from '../appointment-rules';
import {
  appointmentForbidden,
  futureAppointment,
  incompleteAppointment,
  invalidAppointmentAuthor,
  invalidAppointmentEnd,
  soapNotAllowed,
} from '../appointments.errors';
import type { AppointmentResponseDto } from '../dto/appointment-response.dto';
import type { CreateAppointmentRequestDto } from '../dto/create-appointment.dto';
import { Attendance } from '../enums/attendance.enum';
import {
  AppointmentsRepository,
  type CreateAppointmentInput,
} from '../repositories/appointments.repository';

const textOrNull = (value?: string) => value?.trim() || null;

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly appointmentsRepository: AppointmentsRepository,
    private readonly activitiesRepository: ActivitiesRepository,
    private readonly goalsRepository: PtsGoalsRepository,
  ) {}

  async createAppointment(
    activityId: string,
    dto: CreateAppointmentRequestDto,
    account: AccountContext,
    now = new Date(),
  ): Promise<AppointmentResponseDto> {
    const activity = await this.activitiesRepository.findById(activityId);

    if (!activity) {
      throw activityNotFound();
    }

    const pts = await this.goalsRepository.findPtsTarget(activity.ptsId);

    if (!pts) {
      throw ptsNotFound();
    }

    const admin = isAdmin(account);
    const profileId = ownTeamProfile(pts, account) ?? null;

    if (!admin && !profileId) {
      throw appointmentForbidden();
    }

    assertReceivesAppointment(pts.status, activity.status);

    const values = this.toValues(dto, now);

    if (
      admin &&
      dto.authorProfessionalId &&
      !teamIds(pts).includes(dto.authorProfessionalId)
    ) {
      throw invalidAppointmentAuthor();
    }

    const executorName =
      (await this.goalsRepository.findAccountDisplayName(account.accountId)) ??
      (admin ? 'Administrador' : 'Profissional da equipe');

    return this.appointmentsRepository.create({
      ptsId: pts.id,
      activityId,
      values,
      authorProfessionalId: admin
        ? (dto.authorProfessionalId ?? null)
        : profileId,
      executedByAccountId: account.accountId,
      // A evolução não entra no texto: o paciente vê a timeline e só o plano
      // dos atendimentos (RN028).
      description: `${executorName} registrou um atendimento da atividade ${activity.title}`,
    });
  }

  private toValues(
    dto: CreateAppointmentRequestDto,
    now: Date,
  ): CreateAppointmentInput['values'] {
    const done = dto.attendance === Attendance.Done;
    const soap = {
      soapSubjective: textOrNull(dto.soapSubjective),
      soapObjective: textOrNull(dto.soapObjective),
      soapAssessment: textOrNull(dto.soapAssessment),
      soapPlan: textOrNull(dto.soapPlan),
    };
    const endTime = textOrNull(dto.endTime);

    if (done && (!endTime || Object.values(soap).includes(null))) {
      throw incompleteAppointment();
    }

    if (!done && Object.values(soap).some((value) => value !== null)) {
      throw soapNotAllowed();
    }

    // Horas em HH:mm e datas em yyyy-mm-dd comparam como texto.
    if (done && endTime && endTime <= dto.startTime) {
      throw invalidAppointmentEnd();
    }

    // O registro conta o que já aconteceu e não é editado (RN020); só a
    // desmarcação pode ser avisada antes do dia.
    const today = now.toLocaleDateString('en-CA', {
      timeZone: REVIEW_TIME_ZONE,
    });

    if (
      dto.attendance !== Attendance.Cancelled &&
      dto.appointmentDate > today
    ) {
      throw futureAppointment();
    }

    const externalVisit = dto.modality === ActivityModality.ExternalVisit;

    if (externalVisit && !dto.visitPlace) {
      throw missingVisitPlace();
    }

    return {
      appointmentDate: dto.appointmentDate,
      startTime: dto.startTime,
      endTime,
      modality: dto.modality,
      visitPlace: externalVisit ? (dto.visitPlace ?? null) : null,
      attendance: dto.attendance,
      ...soap,
      absenceReason: done ? null : textOrNull(dto.absenceReason),
    };
  }
}
