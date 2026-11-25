import { Injectable } from '@nestjs/common';

import type { AccountContext } from '../../accounts/services/accounts.service';
import {
  activityNotFound,
  missingVisitPlace,
} from '../../activities/activities.errors';
import { ActivityModality } from '../../activities/enums/activity.enums';
import { ActivitiesRepository } from '../../activities/repositories/activities.repository';
import { isAdmin } from '../../auth/account-context';
import { toPagination } from '../../common/pagination/pagination';
import { REVIEW_TIME_ZONE } from '../../notifications/services/review-window.service';
import {
  assertCanViewPts,
  ownTeamProfile,
  teamIds,
} from '../../pts/pts-access';
import { ptsNotFound } from '../../pts/pts.errors';
import { PtsGoalsRepository } from '../../pts/repositories/pts-goals.repository';
import { assertReceivesAppointment } from '../appointment-rules';
import {
  appointmentForbidden,
  appointmentNotFound,
  appointmentsViewForbidden,
  futureAppointment,
  incompleteAppointment,
  invalidAppointmentAuthor,
  invalidAppointmentEnd,
  rectifyForbidden,
  soapNotAllowed,
} from '../appointments.errors';
import type {
  AppointmentDetailsResponseDto,
  AppointmentListItemResponseDto,
  AppointmentListResponseDto,
  AppointmentRecordResponseDto,
} from '../dto/appointment-details-response.dto';
import type { AppointmentResponseDto } from '../dto/appointment-response.dto';
import type { CreateAppointmentRequestDto } from '../dto/create-appointment.dto';
import type { GetAppointmentsQueryDto } from '../dto/get-appointments-query.dto';
import type {
  RectifyAppointmentRequestDto,
  RectifyAppointmentResponseDto,
} from '../dto/rectify-appointment.dto';
import { Attendance } from '../enums/attendance.enum';
import {
  AppointmentsRepository,
  type AppointmentValues,
  type StoredAppointment,
} from '../repositories/appointments.repository';

const textOrNull = (value?: string) => value?.trim() || null;

// yyyy-mm-dd → dd/mm/yyyy, para o texto da timeline.
const toBrazilianDate = (date: string) => date.split('-').reverse().join('/');

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

    const executorName = await this.executorName(account);

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

  /**
   * Lista os atendimentos no escopo de quem pede (RFACT006): o admin vê
   * todos; o profissional, os dos PTS da equipe (RN016); o paciente, os dele.
   */
  async findAppointments(
    query: GetAppointmentsQueryDto,
    account: AccountContext,
  ): Promise<AppointmentListResponseDto> {
    const admin = isAdmin(account);
    const professional = account.professionalProfileIds.length > 0;

    if (!admin && !professional && !account.patientProfileId) {
      throw appointmentsViewForbidden();
    }

    // O paciente não consulta os atendimentos de outro paciente.
    if (
      !admin &&
      !professional &&
      query.patientId &&
      query.patientId !== account.patientProfileId
    ) {
      throw appointmentsViewForbidden();
    }

    if (query.activityId) {
      const activity = await this.activitiesRepository.findById(
        query.activityId,
      );

      if (!activity) {
        throw activityNotFound();
      }

      await this.assertCanView(activity.ptsId, account);
    }

    if (query.ptsId) {
      await this.assertCanView(query.ptsId, account);
    }

    const { rows, total } = await this.appointmentsRepository.findMany({
      ...query,
      scope: admin
        ? null
        : {
            patientId: account.patientProfileId,
            professionalIds: account.professionalProfileIds,
          },
    });

    return {
      data: rows.map((row) => this.toListItem(row)),
      pagination: toPagination(query, total),
    };
  }

  /** Um atendimento com as retificações; o paciente vê só o plano (RN028). */
  async findAppointment(
    id: string,
    account: AccountContext,
  ): Promise<AppointmentDetailsResponseDto> {
    const appointment = await this.appointmentsRepository.findById(id);

    if (!appointment) {
      throw appointmentNotFound();
    }

    const pts = await this.assertCanView(appointment.ptsId, account);
    const team = isAdmin(account) || ownTeamProfile(pts, account) !== undefined;
    // A retificação não tem retificações: elas ficam todas no original.
    const rectifications = appointment.rectifiesAppointmentId
      ? []
      : await this.appointmentsRepository.findRectifications(id);

    return {
      ...this.toRecord(appointment, team),
      patient: appointment.patient,
      pts: appointment.pts,
      activity: appointment.activity,
      rectifiesAppointmentId: appointment.rectifiesAppointmentId,
      rectified: rectifications.length > 0,
      rectifications: rectifications.map((item) => this.toRecord(item, team)),
    };
  }

  /**
   * Registra a retificação (RFACT007): só o autor, com justificativa, e o
   * original não muda (RN020).
   */
  async rectifyAppointment(
    id: string,
    dto: RectifyAppointmentRequestDto,
    account: AccountContext,
    now = new Date(),
  ): Promise<RectifyAppointmentResponseDto> {
    const appointment = await this.appointmentsRepository.findById(id);

    if (!appointment) {
      throw appointmentNotFound();
    }

    await this.assertCanView(appointment.ptsId, account, rectifyForbidden);

    const authorId = appointment.author?.id;

    if (!authorId || !account.professionalProfileIds.includes(authorId)) {
      throw rectifyForbidden();
    }

    const values = this.toValues(dto, now);
    const executorName = await this.executorName(account);

    return this.appointmentsRepository.rectify({
      ptsId: appointment.ptsId,
      // Retificar uma retificação corrige o mesmo original.
      appointmentId: appointment.rectifiesAppointmentId ?? appointment.id,
      values,
      reason: dto.reason.trim(),
      authorProfessionalId: authorId,
      executedByAccountId: account.accountId,
      description: `${executorName} retificou o atendimento de ${toBrazilianDate(appointment.appointmentDate)} da atividade ${appointment.activity.title}`,
    });
  }

  private async assertCanView(
    ptsId: string,
    account: AccountContext,
    forbidden = appointmentsViewForbidden,
  ) {
    const pts = await this.goalsRepository.findPtsTarget(ptsId);

    if (!pts) {
      throw ptsNotFound();
    }

    assertCanViewPts(pts, account, forbidden);

    return pts;
  }

  private async executorName(account: AccountContext): Promise<string> {
    return (
      (await this.goalsRepository.findAccountDisplayName(account.accountId)) ??
      (isAdmin(account) ? 'Administrador' : 'Profissional da equipe')
    );
  }

  private toListItem(row: StoredAppointment): AppointmentListItemResponseDto {
    return {
      id: row.id,
      appointmentDate: row.appointmentDate,
      startTime: row.startTime,
      endTime: row.endTime,
      patient: row.patient,
      pts: row.pts,
      activity: row.activity,
      author: row.author,
      modality: row.modality,
      visitPlace: row.visitPlace,
      attendance: row.attendance,
      rectified: row.rectified,
    };
  }

  // A equipe vê o SOAP e a justificativa; o paciente, só o plano (RN028).
  private toRecord(
    row: StoredAppointment,
    team: boolean,
  ): AppointmentRecordResponseDto {
    const record: AppointmentRecordResponseDto = {
      id: row.id,
      appointmentDate: row.appointmentDate,
      startTime: row.startTime,
      endTime: row.endTime,
      modality: row.modality,
      visitPlace: row.visitPlace,
      attendance: row.attendance,
      author: row.author,
      registeredBy: row.registeredBy,
      createdAt: row.createdAt,
      absenceReason: row.absenceReason,
    };

    if (!team) {
      return { ...record, plan: row.soapPlan };
    }

    return {
      ...record,
      soap:
        row.attendance === Attendance.Done
          ? {
              subjective: row.soapSubjective ?? '',
              objective: row.soapObjective ?? '',
              assessment: row.soapAssessment ?? '',
              plan: row.soapPlan ?? '',
            }
          : null,
      rectificationReason: row.rectificationReason,
    };
  }

  private toValues(
    dto: CreateAppointmentRequestDto,
    now: Date,
  ): AppointmentValues {
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
