import type {
  ActivityDetailsResponseDto,
  ActivityResponseDto,
} from '../dto/activity-response.dto';
import type { ActivityStatusResponseDto } from '../dto/activity-status.dto';
import type { ArchiveActivityResponseDto } from '../dto/archive-activity.dto';
import type { ActivityStatusAction } from '../activity-rules';
import type { ActivityState } from '../enums/activity.enums';
import type { ActivityExecutor } from '../enums/activity.enums';

export interface FindActivitiesInput {
  ptsId: string;
  status?: ActivityState[];
  executor?: ActivityExecutor;
  page: number;
  limit: number;
}

export interface FindActivitiesResult {
  rows: ActivityResponseDto[];
  total: number;
}

export interface CreateActivityInput {
  ptsId: string;
  values: Omit<
    ActivityResponseDto,
    | 'id'
    | 'status'
    | 'createdAt'
    | 'updatedAt'
    | 'authorProfessionalId'
    | 'executorProfessionalIds'
    | 'documentIds'
  >;
  executorProfessionalIds: string[];
  documentIds: string[];
  /** Autoria (RN029) e texto do evento gravado na timeline. */
  authorProfessionalId: string | null;
  executedByAccountId: string;
  description: string;
}

/** Atividade com o PTS dela: a edição chega só com o id da atividade. */
export type StoredActivity = ActivityResponseDto & { ptsId: string };
export type StoredActivityDetails = ActivityDetailsResponseDto;

export interface UpdateActivityInput {
  ptsId: string;
  activityId: string;
  /** Valores finais dos campos editáveis (RFACT005). */
  values: Pick<
    ActivityResponseDto,
    | 'title'
    | 'description'
    | 'type'
    | 'frequency'
    | 'modality'
    | 'visitPlace'
    | 'goalId'
  >;
  /** Ausente, os documentos ficam como estão. */
  documentIds?: string[];
  /** Estados que quem edita pode alterar, conferidos de novo na transação. */
  allowedStates: ActivityState[];
  /** Autoria e texto do activity_updated. */
  authorProfessionalId: string | null;
  executedByAccountId: string;
  description: string;
  /** Texto do activity_goal_unlinked, gravado só quando a meta é desligada. */
  goalUnlinkedDescription: string;
}

export interface ArchiveActivityInput {
  ptsId: string;
  activityId: string;
  /** Motivo opcional, gravado em status_reason. */
  reason: string | null;
  /** Autoria e texto do activity_archived. */
  authorProfessionalId: string | null;
  executedByAccountId: string;
  description: string;
}

export interface ChangeActivityStatusInput {
  ptsId: string;
  activityId: string;
  action: ActivityStatusAction;
  /** Motivo opcional da suspensão; nulo nas outras ações. */
  reason: string | null;
  /** Autoria e texto do evento. */
  authorProfessionalId: string | null;
  executedByAccountId: string;
  description: string;
}

export abstract class ActivitiesRepository {
  abstract findByPts(input: FindActivitiesInput): Promise<FindActivitiesResult>;
  abstract findById(activityId: string): Promise<StoredActivity | null>;
  abstract findDetailsById(
    activityId: string,
  ): Promise<StoredActivityDetails | null>;
  /** Dos ids informados, os documentos não excluídos do paciente. */
  abstract findPatientDocumentIds(
    patientId: string,
    ids: string[],
  ): Promise<string[]>;
  abstract create(input: CreateActivityInput): Promise<ActivityResponseDto>;
  abstract update(input: UpdateActivityInput): Promise<ActivityResponseDto>;
  abstract changeStatus(
    input: ChangeActivityStatusInput,
  ): Promise<ActivityStatusResponseDto>;
  abstract archive(
    input: ArchiveActivityInput,
  ): Promise<ArchiveActivityResponseDto>;
}
