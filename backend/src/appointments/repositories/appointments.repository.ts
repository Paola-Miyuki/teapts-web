import type { ActivityModality } from '../../activities/enums/activity.enums';
import type { Specialism } from '../../professionals/enums/specialism.enum';
import type {
  AppointmentActivityResponseDto,
  AppointmentAuthorResponseDto,
  AppointmentPersonResponseDto,
  AppointmentPtsResponseDto,
} from '../dto/appointment-details-response.dto';
import type { AppointmentResponseDto } from '../dto/appointment-response.dto';
import type { RectifyAppointmentResponseDto } from '../dto/rectify-appointment.dto';
import type { AppointmentEntity } from '../entities/appointment.entity';
import type { Attendance } from '../enums/attendance.enum';

export type AppointmentValues = Pick<
  AppointmentEntity,
  | 'appointmentDate'
  | 'startTime'
  | 'endTime'
  | 'modality'
  | 'visitPlace'
  | 'attendance'
  | 'soapSubjective'
  | 'soapObjective'
  | 'soapAssessment'
  | 'soapPlan'
  | 'absenceReason'
>;

export interface CreateAppointmentInput {
  ptsId: string;
  activityId: string;
  values: AppointmentValues;
  /** Autoria (RN029) e texto do evento gravado na timeline. */
  authorProfessionalId: string | null;
  executedByAccountId: string;
  description: string;
}

/** Atendimento gravado, com os nomes já resolvidos (RFACT006). */
export interface StoredAppointment extends AppointmentValues {
  id: string;
  ptsId: string;
  rectifiesAppointmentId: string | null;
  rectificationReason: string | null;
  patient: AppointmentPersonResponseDto;
  pts: AppointmentPtsResponseDto;
  activity: AppointmentActivityResponseDto;
  author: AppointmentAuthorResponseDto | null;
  registeredBy: AppointmentPersonResponseDto;
  /** Tem ao menos uma retificação. */
  rectified: boolean;
  createdAt: string;
}

/** Quem pede a lista; `null` é o admin, que vê todos (RN022). */
export interface AppointmentsScope {
  patientId: string | null;
  professionalIds: string[];
}

export interface FindAppointmentsInput {
  scope: AppointmentsScope | null;
  patientId?: string;
  ptsId?: string;
  activityId?: string;
  attendance?: Attendance[];
  specialism?: Specialism[];
  modality?: ActivityModality[];
  from?: string;
  to?: string;
  page: number;
  limit: number;
}

export interface FindAppointmentsResult {
  rows: StoredAppointment[];
  total: number;
}

export interface RectifyAppointmentInput {
  ptsId: string;
  /** O atendimento original, que não muda (RN020). */
  appointmentId: string;
  values: AppointmentValues;
  reason: string;
  authorProfessionalId: string;
  executedByAccountId: string;
  description: string;
}

export abstract class AppointmentsRepository {
  abstract create(
    input: CreateAppointmentInput,
  ): Promise<AppointmentResponseDto>;

  /** Só os originais, do mais recente ao mais antigo. */
  abstract findMany(
    input: FindAppointmentsInput,
  ): Promise<FindAppointmentsResult>;

  abstract findById(id: string): Promise<StoredAppointment | null>;

  /** Retificações do original, da mais antiga à mais nova. */
  abstract findRectifications(id: string): Promise<StoredAppointment[]>;

  abstract rectify(
    input: RectifyAppointmentInput,
  ): Promise<RectifyAppointmentResponseDto>;
}
