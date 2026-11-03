import type { CreatePtsResponseDto } from '../dto/create-pts.dto';
import type { ActivePtsResponseDto } from '../dto/active-pts-response.dto';
import type { PtsProposalResponseDto } from '../dto/pts-proposal-response.dto';
import type { UpdateSocialSituationResponseDto } from '../dto/update-social-situation.dto';

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

export interface UpdatePtsProposalInput {
  id: string;
  socialSituation?: string;
  teamProfessionalIds?: string[];
}

export interface SocialSituationTarget {
  id: string;
  status: string;
  responsibleProfessionalId: string;
  teamProfessionalIds: string[];
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

  abstract findActivePtsByPatientId(
    patientId: string,
  ): Promise<ActivePtsResponseDto | null>;

  abstract findProposalById(id: string): Promise<PtsProposalResponseDto | null>;

  abstract updateDraftProposal(
    input: UpdatePtsProposalInput,
  ): Promise<PtsProposalResponseDto>;

  abstract findSocialSituationTarget(
    id: string,
  ): Promise<SocialSituationTarget | null>;

  abstract updateSocialSituation(
    id: string,
    socialSituation: string,
  ): Promise<UpdateSocialSituationResponseDto>;

  abstract hasProposalRelation(
    patientId: string,
    profileIds: string[],
  ): Promise<boolean>;
}
