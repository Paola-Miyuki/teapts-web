import type { PtsDetailResponseDto } from '../dto/pts-detail-response.dto';
import type { CreatePtsResponseDto } from '../dto/create-pts.dto';
import type { ActivePtsResponseDto } from '../dto/active-pts-response.dto';
import type { PtsProposalResponseDto } from '../dto/pts-proposal-response.dto';
import type { UpdateSocialSituationResponseDto } from '../dto/update-social-situation.dto';
import type { PtsDecisionResponseDto } from '../dto/pts-decision-response.dto';
import type { PtsStartResponseDto } from '../dto/pts-start-response.dto';
import type { PtsTeamResponseDto } from '../dto/pts-team-response.dto';
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
  responsibleName: string;
  teamMembers: Array<{
    professionalId: string;
    accountId: string;
  }>;
}

export interface ProfessionalAccountRecord {
  id: string;
  accountId: string;
  name: string;
}

export interface AddTeamMembersInput {
  ptsId: string;
  /** Um evento na timeline por profissional adicionado. */
  members: Array<{ professionalId: string; description: string }>;
  /** Profissional atribuído aos eventos (RN029); nulo quando o admin age. */
  authorProfessionalId: string | null;
  /** Conta que executou a ação (RN029). */
  executedByAccountId: string;
}

export interface RemoveTeamMemberInput {
  ptsId: string;
  professionalId: string;
  /** Profissional atribuído ao evento (RN029); nulo quando o admin age. */
  authorProfessionalId: string | null;
  /** Conta que executou a ação (RN029). */
  executedByAccountId: string;
  /** Texto do evento na timeline. */
  description: string;
}

export interface TransferResponsibilityInput {
  ptsId: string;
  newResponsibleId: string;
  /** Profissional atribuído ao evento (RN029); nulo quando o admin age. */
  authorProfessionalId: string | null;
  /** Conta que executou a ação (RN029). */
  executedByAccountId: string;
  /** Texto do evento na timeline. */
  description: string;
}

export interface StartPtsInput {
  ptsId: string;
  /** Profissional atribuído ao evento (RN029); nulo quando o admin age. */
  authorProfessionalId: string | null;
  /** Conta que executou a ação (RN029). */
  executedByAccountId: string;
  /** Texto do evento na timeline. */
  description: string;
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

  /** Nome social, se houver; senão o nome. */
  abstract findAccountDisplayName(accountId: string): Promise<string | null>;

  /** PTS com responsável e equipe, em qualquer estado. */
  abstract findPtsTeam(id: string): Promise<PtsTeamResponseDto | null>;

  /**
   * Remove o vínculo do profissional com o PTS e grava o evento na timeline,
   * na mesma transação.
   */
  abstract removeTeamMember(
    input: RemoveTeamMemberInput,
  ): Promise<PtsTeamResponseDto>;

  abstract transferResponsibility(
    input: TransferResponsibilityInput,
  ): Promise<PtsTeamResponseDto>;

  /**
   * Passa o PTS de planning para running e grava o evento na timeline, na
   * mesma transação.
   */
  abstract startPts(input: StartPtsInput): Promise<PtsStartResponseDto>;

  abstract rejectProposal(id: string): Promise<PtsDecisionResponseDto>;

  /** Exclusão lógica da proposta em DRAFT: preenche deletedAt. */
  abstract softDeleteProposal(id: string): Promise<void>;

  abstract findPtsTeamTarget(id: string): Promise<PtsTeamTarget | null>;

  abstract findProfessionalsWithAccountByIds(
    ids: string[],
  ): Promise<ProfessionalAccountRecord[]>;

  /**
   * Cria os vínculos dos profissionais com o PTS e grava um evento por
   * profissional na timeline, na mesma transação.
   */
  abstract addTeamMembers(
    input: AddTeamMembersInput,
  ): Promise<PtsTeamResponseDto>;
}
