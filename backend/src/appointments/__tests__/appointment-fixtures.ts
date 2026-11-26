import { ActivityModality } from '../../activities/enums/activity.enums';
import { Specialism } from '../../professionals/enums/specialism.enum';
import type { AppointmentResponseDto } from '../dto/appointment-response.dto';
import type { CreateAppointmentRequestDto } from '../dto/create-appointment.dto';
import type {
  RectifyAppointmentRequestDto,
  RectifyAppointmentResponseDto,
} from '../dto/rectify-appointment.dto';
import { Attendance } from '../enums/attendance.enum';
import {
  AppointmentsRepository,
  type CreateAppointmentInput,
  type FindAppointmentsInput,
  type FindAppointmentsResult,
  type RectifyAppointmentInput,
  type StoredAppointment,
} from '../repositories/appointments.repository';

export const APPOINTMENT_ID = '2b1a0f9e-8d7c-4b6a-9e5d-4c3b2a190807';
export const RECTIFICATION_ID = '6d5c4b3a-2190-4f8e-8d7c-6b5a49382716';

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

export const rectifyBody = (
  overrides: Partial<RectifyAppointmentRequestDto> = {},
): RectifyAppointmentRequestDto => ({
  ...appointmentBody({ endTime: '14:50' }),
  reason: 'Horário de término registrado errado.',
  ...overrides,
});

/** Atendimento realizado do pts-1, registrado pelo prof-2 (membro). */
export const storedAppointment = (
  overrides: Partial<StoredAppointment> = {},
): StoredAppointment => ({
  id: APPOINTMENT_ID,
  ptsId: 'pts-1',
  appointmentDate: '2026-11-03',
  startTime: '14:00',
  endTime: '14:45',
  modality: ActivityModality.InPerson,
  visitPlace: null,
  attendance: Attendance.Done,
  soapSubjective: 'Chegou tranquilo; a mãe relatou boa semana.',
  soapObjective: 'Manteve o circuito por 15 minutos.',
  soapAssessment: 'Avanço na tolerância a estímulos táteis.',
  soapPlan: 'Repetir o circuito e orientar a família sobre a rotina.',
  absenceReason: null,
  rectifiesAppointmentId: null,
  rectificationReason: null,
  patient: { id: 'patient-1', name: 'Luna Prado' },
  pts: { id: 'pts-1', version: 1 },
  activity: {
    id: 'act-1',
    title: 'Integração sensorial',
    specialism: Specialism.OccupationalTherapist,
  },
  author: {
    id: 'prof-2',
    name: 'João Lima',
    specialism: Specialism.OccupationalTherapist,
  },
  registeredBy: { id: 'acc-2', name: 'João Lima' },
  rectified: false,
  createdAt: '2026-11-03T17:50:00.000Z',
  ...overrides,
});

/** Retificação do atendimento acima, com o término corrigido. */
export const storedRectification = (
  overrides: Partial<StoredAppointment> = {},
): StoredAppointment =>
  storedAppointment({
    id: RECTIFICATION_ID,
    endTime: '14:50',
    rectifiesAppointmentId: APPOINTMENT_ID,
    rectificationReason: 'Horário de término registrado errado.',
    createdAt: '2026-11-04T12:00:00.000Z',
    ...overrides,
  });

export class InMemoryAppointmentsRepository extends AppointmentsRepository {
  created: CreateAppointmentInput[] = [];
  rectifications: RectifyAppointmentInput[] = [];
  searches: FindAppointmentsInput[] = [];
  appointments: StoredAppointment[] = [];

  async create(input: CreateAppointmentInput): Promise<AppointmentResponseDto> {
    this.created.push(input);

    return {
      id: APPOINTMENT_ID,
      activityId: input.activityId,
      attendance: input.values.attendance,
      appointmentDate: input.values.appointmentDate,
      createdAt: '2026-11-03T17:50:00.000Z',
    };
  }

  // O escopo fica no SQL; aqui só os filtros, para conferir o que chega.
  async findMany(
    input: FindAppointmentsInput,
  ): Promise<FindAppointmentsResult> {
    this.searches.push(input);

    const rows = this.appointments.filter(
      (item) =>
        item.rectifiesAppointmentId === null &&
        (!input.patientId || item.patient.id === input.patientId) &&
        (!input.ptsId || item.ptsId === input.ptsId) &&
        (!input.activityId || item.activity.id === input.activityId) &&
        (!input.attendance || input.attendance.includes(item.attendance)),
    );
    const start = (input.page - 1) * input.limit;

    return {
      rows: rows.slice(start, start + input.limit),
      total: rows.length,
    };
  }

  async findById(id: string): Promise<StoredAppointment | null> {
    return this.appointments.find((item) => item.id === id) ?? null;
  }

  async findRectifications(id: string): Promise<StoredAppointment[]> {
    return this.appointments.filter(
      (item) => item.rectifiesAppointmentId === id,
    );
  }

  async rectify(
    input: RectifyAppointmentInput,
  ): Promise<RectifyAppointmentResponseDto> {
    this.rectifications.push(input);

    return {
      id: RECTIFICATION_ID,
      rectifiesAppointmentId: input.appointmentId,
      createdAt: '2026-11-04T12:00:00.000Z',
    };
  }
}
