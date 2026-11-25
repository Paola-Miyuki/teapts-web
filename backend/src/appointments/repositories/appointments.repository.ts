import type { AppointmentResponseDto } from '../dto/appointment-response.dto';
import type { AppointmentEntity } from '../entities/appointment.entity';

export interface CreateAppointmentInput {
  ptsId: string;
  activityId: string;
  values: Pick<
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
  /** Autoria (RN029) e texto do evento gravado na timeline. */
  authorProfessionalId: string | null;
  executedByAccountId: string;
  description: string;
}

export abstract class AppointmentsRepository {
  abstract create(
    input: CreateAppointmentInput,
  ): Promise<AppointmentResponseDto>;
}
