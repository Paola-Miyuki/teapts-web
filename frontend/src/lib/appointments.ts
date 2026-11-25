import type { ActivityModality, VisitPlace } from '@/lib/activities';
import { request } from '@/lib/api';

export type Attendance = 'done' | 'missed' | 'cancelled';

export const ATTENDANCE_LABELS: Record<Attendance, string> = {
  done: 'Realizado',
  missed: 'Falta',
  cancelled: 'Desmarcado',
};

export type SoapInput = {
  soapSubjective: string;
  soapObjective: string;
  soapAssessment: string;
  soapPlan: string;
};

export type AppointmentInput = Partial<SoapInput> & {
  appointmentDate: string;
  startTime: string;
  endTime?: string;
  modality: ActivityModality;
  visitPlace?: VisitPlace;
  attendance: Attendance;
  absenceReason?: string;
  // Só o admin atribui (RN029).
  authorProfessionalId?: string;
};

export type Appointment = {
  id: string;
  activityId: string;
  attendance: Attendance;
  appointmentDate: string;
  createdAt: string;
};

export function createAppointment(
  activityId: string,
  appointment: AppointmentInput,
) {
  return request<Appointment>(
    `/activities/${encodeURIComponent(activityId)}/appointments`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appointment),
    },
  );
}

/** Página "Registrar atendimento" com a atividade já escolhida. */
export function newAppointmentHref(ptsId: string, activityId: string) {
  const params = new URLSearchParams({ pts: ptsId, activity: activityId });

  return `/appointments/new?${params.toString()}`;
}
