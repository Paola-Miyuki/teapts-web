import { CreatePtsResponseDto } from '../dto/create-pts.dto';

export interface ProfessionalRecord {
  id: string;
  accountId: string;
}

export interface CreateDraftInput {
  patientId: string;
  responsibleProfessionalId: string;
  socialSituation: string;
  teamProfessionalIds: string[];
}

/** Contrato de persistência dos PTS. */
export abstract class PtsRepository {
  abstract findProfessionalById(id: string): Promise<ProfessionalRecord | null>;

  abstract patientExists(id: string): Promise<boolean>;

  abstract hasApprovedActivePts(patientId: string): Promise<boolean>;

  abstract findExistingProfessionalIds(ids: string[]): Promise<string[]>;

  abstract createDraft(input: CreateDraftInput): Promise<CreatePtsResponseDto>;
}
