import type { PtsDetailResponseDto } from '../dto/pts-detail-response.dto';
import type { CreatePtsResponseDto } from '../dto/create-pts.dto';
import type { ActivePtsResponseDto } from '../dto/active-pts-response.dto';
import type { PtsProposalResponseDto } from '../dto/pts-proposal-response.dto';
import type { UpdateSocialSituationResponseDto } from '../dto/update-social-situation.dto';
import type { PtsDecisionResponseDto } from '../dto/pts-decision-response.dto';
import type { PtsTeamResponseDto } from '../dto/add-pts-team-members.dto';
import type { PtsStateEnum } from '../../database/enums/pts-state.enum';

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
  /** null: propostas de todos os pacientes que a conta pode ver. */
  patientId: string | null;
  /** Parte do nome ou do nome social do paciente. */
  q: string | null;
  isPatient: boolean;
  isAdmin: boolean;
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

export interface ProposalDecisionTarget {
  id: string;
  status: PtsStateEnum;
  patientId: string;
}

export interface PtsTeamTarget {
  id: string;
  status: PtsStateEnum;
  responsibleProfessionalId: string;
  responsibleAccountId: string;
  teamMembers: Array<{
    professionalId: string;
    accountId: string;
  }>;
}

export interface ProfessionalAccountRecord {
  id: string;
  accountId: string;
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

  abstract findPtsById(id: string): Promise<PtsDetailResponseDto | null>;

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

  abstract findProposalForDecision(
    id: string,
  ): Promise<ProposalDecisionTarget | null>;

  abstract approveProposal(
    id: string,
    patientId: string,
  ): Promise<PtsDecisionResponseDto>;

  abstract rejectProposal(id: string): Promise<PtsDecisionResponseDto>;

  /** Exclusão lógica da proposta em DRAFT: preenche deletedAt. */
  abstract softDeleteProposal(id: string): Promise<void>;

  abstract findPtsTeamTarget(id: string): Promise<PtsTeamTarget | null>;

  abstract findProfessionalsWithAccountByIds(
    ids: string[],
  ): Promise<ProfessionalAccountRecord[]>;

  abstract addTeamMembers(
    ptsId: string,
    professionalIds: string[],
  ): Promise<PtsTeamResponseDto>;
}
