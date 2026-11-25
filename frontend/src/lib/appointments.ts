import {
  ACTIVITY_MODALITY_LABELS,
  VISIT_PLACE_LABELS,
  type ActivityModality,
  type ActivityPagination,
  type VisitPlace,
} from '@/lib/activities';
import { request } from '@/lib/api';
import { SPECIALISMS } from '@/lib/professionals';

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

// --- Consultar (RFACT006) e retificar (RFACT007) ---------------------------

export type AppointmentPerson = { id: string; name: string };

export type AppointmentAuthor = AppointmentPerson & { specialism: string };

export type AppointmentListItem = {
  id: string;
  appointmentDate: string;
  startTime: string;
  endTime: string | null;
  patient: AppointmentPerson;
  pts: { id: string; version: number };
  activity: { id: string; title: string; specialism: string };
  author: AppointmentAuthor | null;
  modality: ActivityModality;
  visitPlace: VisitPlace | null;
  attendance: Attendance;
  // Tem retificação; o original continua guardado (RN020).
  rectified: boolean;
};

export type AppointmentList = {
  data: AppointmentListItem[];
  pagination: ActivityPagination;
};

export type AppointmentSoap = {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};

// Um registro: o original ou uma retificação. A equipe recebe `soap` e
// `rectificationReason`; o paciente, só `plan` (RN028).
export type AppointmentRecord = {
  id: string;
  appointmentDate: string;
  startTime: string;
  endTime: string | null;
  modality: ActivityModality;
  visitPlace: VisitPlace | null;
  attendance: Attendance;
  author: AppointmentAuthor | null;
  registeredBy: AppointmentPerson;
  createdAt: string;
  soap?: AppointmentSoap | null;
  plan?: string | null;
  absenceReason: string | null;
  rectificationReason?: string | null;
};

export type AppointmentDetails = AppointmentRecord & {
  patient: AppointmentPerson;
  pts: { id: string; version: number };
  activity: { id: string; title: string; specialism: string };
  rectifiesAppointmentId: string | null;
  rectified: boolean;
  rectifications: AppointmentRecord[];
};

export type AppointmentsQuery = {
  page: number;
  limit: number;
  patientId?: string;
  ptsId?: string;
  activityId?: string;
  attendance?: Attendance[];
  specialism?: string[];
  modality?: ActivityModality[];
  from?: string;
  to?: string;
};

export type RectifyAppointmentInput = AppointmentInput & { reason: string };

export type RectifiedAppointment = {
  id: string;
  rectifiesAppointmentId: string;
  createdAt: string;
};

export function getAppointments(
  query: AppointmentsQuery,
  signal?: AbortSignal,
) {
  const search = new URLSearchParams({
    page: String(query.page),
    limit: String(query.limit),
  });

  for (const key of [
    'patientId',
    'ptsId',
    'activityId',
    'from',
    'to',
  ] as const) {
    const value = query[key];

    if (value) {
      search.set(key, value);
    }
  }

  for (const key of ['attendance', 'specialism', 'modality'] as const) {
    const values: readonly string[] = query[key] ?? [];

    values.forEach((value) => search.append(key, value));
  }

  return request<AppointmentList>(`/appointments?${search.toString()}`, {
    signal,
  });
}

export function getAppointment(id: string, signal?: AbortSignal) {
  return request<AppointmentDetails>(
    `/appointments/${encodeURIComponent(id)}`,
    { signal },
  );
}

export function rectifyAppointment(
  id: string,
  appointment: RectifyAppointmentInput,
) {
  return request<RectifiedAppointment>(
    `/appointments/${encodeURIComponent(id)}/rectify`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appointment),
    },
  );
}

/** "Visita externa (Escola)", ou só a modalidade. */
export function appointmentModalityLabel({
  modality,
  visitPlace,
}: {
  modality: ActivityModality;
  visitPlace: VisitPlace | null;
}) {
  return visitPlace
    ? `${ACTIVITY_MODALITY_LABELS[modality]} (${VISIT_PLACE_LABELS[visitPlace]})`
    : ACTIVITY_MODALITY_LABELS[modality];
}

export function specialismLabel(value: string) {
  return SPECIALISMS.find((item) => item.value === value)?.label ?? value;
}
