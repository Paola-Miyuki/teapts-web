import { ActivityModality } from '../../activities/enums/activity.enums';
import type { AppointmentResponseDto } from '../dto/appointment-response.dto';
import type { CreateAppointmentRequestDto } from '../dto/create-appointment.dto';
import { Attendance } from '../enums/attendance.enum';
import {
  AppointmentsRepository,
  type CreateAppointmentInput,
} from '../repositories/appointments.repository';

export const appointmentBody = (
  overrides: Partial<CreateAppointmentRequestDto> = {},
): CreateAppointmentRequestDto => ({
  appointmentDate: '2026-11-03',
  startTime: '14:00',
  endTime: '14:45',
  modality: ActivityModality.InPerson,
  attendance: Attendance.Done,
  soapSubjective: 'Chegou tranquilo; a mãe relatou boa semana.',
  soapObjective: 'Manteve o circuito por 15 minutos.',
  soapAssessment: 'Avanço na tolerância a estímulos táteis.',
  soapPlan: 'Repetir o circuito e orientar a família sobre a rotina.',
  ...overrides,
});

export const absenceBody = (
  overrides: Partial<CreateAppointmentRequestDto> = {},
): CreateAppointmentRequestDto => ({
  appointmentDate: '2026-11-03',
  startTime: '14:00',
  modality: ActivityModality.InPerson,
  attendance: Attendance.Missed,
  ...overrides,
});

export class InMemoryAppointmentsRepository extends AppointmentsRepository {
  created: CreateAppointmentInput[] = [];

  async create(input: CreateAppointmentInput): Promise<AppointmentResponseDto> {
    this.created.push(input);

    return {
      id: '2b1a0f9e-8d7c-4b6a-9e5d-4c3b2a190807',
      activityId: input.activityId,
      attendance: input.values.attendance,
      appointmentDate: input.values.appointmentDate,
      createdAt: '2026-11-03T17:50:00.000Z',
    };
  }
}
