import type { CreatePtsResponseDto } from '../dto/create-pts.dto';
import type { PtsProposalResponseDto } from '../dto/pts-proposal-response.dto';

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

export interface FindPtsProposalsInput {
  accountId: string;
  patientId: string;
  isPatient: boolean;
  professionalProfileIds: string[];
  page: number;
  limit: number;
}

export interface FindPtsProposalsResult {
  rows: PtsProposalResponseDto[];
  total: number;
}

/** Contrato de persistência dos PTS. */
export abstract class PtsRepository {
  abstract findProfessionalById(id: string): Promise<ProfessionalRecord | null>;

  abstract patientExists(id: string): Promise<boolean>;

  abstract hasApprovedActivePts(patientId: string): Promise<boolean>;

  abstract findExistingProfessionalIds(ids: string[]): Promise<string[]>;

  abstract createDraft(input: CreateDraftInput): Promise<CreatePtsResponseDto>;

  abstract findDraftProposals(
    input: FindPtsProposalsInput,
  ): Promise<FindPtsProposalsResult>;

  abstract findDraftProposalById(
    id: string,
  ): Promise<PtsProposalResponseDto | null>;

    abstract hasProposalRelation(
    patientId: string,
    profileIds: string[],
  ): Promise<boolean>;
}
