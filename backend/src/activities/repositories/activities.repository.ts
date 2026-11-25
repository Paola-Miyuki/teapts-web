import type { ActivityResponseDto } from '../dto/activity-response.dto';

export interface CreateActivityInput {
  ptsId: string;
  values: Omit<
    ActivityResponseDto,
    'id' | 'status' | 'createdAt' | 'executorProfessionalIds' | 'documentIds'
  >;
  executorProfessionalIds: string[];
  documentIds: string[];
  /** Autoria (RN029) e texto do evento gravado na timeline. */
  authorProfessionalId: string | null;
  executedByAccountId: string;
  description: string;
}

export abstract class ActivitiesRepository {
  abstract findByPts(ptsId: string): Promise<ActivityResponseDto[]>;
  /** Dos ids informados, os documentos não excluídos do paciente. */
  abstract findPatientDocumentIds(
    patientId: string,
    ids: string[],
  ): Promise<string[]>;
  abstract create(input: CreateActivityInput): Promise<ActivityResponseDto>;
}
