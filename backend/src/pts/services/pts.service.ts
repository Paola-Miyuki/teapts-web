import { Injectable } from '@nestjs/common';

import { CreatePtsRequestDto } from '../dto/create-pts.dto';
import type { UpdatePtsProposalRequestDto } from '../dto/update-pts-proposal.dto';
import type { TransferPtsResponsibilityRequestDto } from '../dto/transfer-pts-responsibility.dto';
import type { GetPtsProposalsQueryDto } from '../dto/get-pts-proposals-query.dto';
import type {
  GetPtsProposalsResponseDto,
  PtsProposalResponseDto,
} from '../dto/pts-proposal-response.dto';
import type { GetActivePtsQueryDto } from '../dto/get-active-pts-query.dto';
import type { ActivePtsResponseDto } from '../dto/active-pts-response.dto';
import type { PtsDetailResponseDto } from '../dto/pts-detail-response.dto';
import type {
  UpdateSocialSituationRequestDto,
  UpdateSocialSituationResponseDto,
} from '../dto/update-social-situation.dto';
import type { PtsStartResponseDto } from '../dto/pts-start-response.dto';
import type { PtsTeamResponseDto } from '../dto/pts-team-response.dto';
import type { PtsDecisionResponseDto } from '../dto/pts-decision-response.dto';
import type { DeletePtsProposalResponseDto } from '../dto/delete-pts-proposal-response.dto';
import type { AddPtsTeamMembersRequestDto } from '../dto/add-pts-team-members.dto';
import { PtsRepository } from '../repositories/pts.repository';
import type { AccountContext } from '../../accounts/services/accounts.service';
import { isAdmin } from '../../auth/account-context';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import {
  activePtsAlreadyExists,
  patientNotFound,
  professionalNotAuthorized,
  ptsActiveExists,
  ptsProposalEditForbidden,
  ptsProposalForbidden,
  ptsProposalNotDraft,
  ptsProposalNotFound,
  ptsProposalNotPending,
  activePtsForbidden,
  activePtsNotFound,
  ptsNotActive,
  ptsForbidden,
  ptsNotFound,
  ptsNotPlanning,
  ptsStartForbidden,
  cannotRemoveResponsible,
  teamEditForbidden,
  teamMemberNotFound,
  socialSituationForbidden,
  teamProfessionalNotFound,
  validationError,
  ptsProposalDeleteForbidden,
  ptsProposalNotDraftForDelete,
  teamDuplicateAccount,
  newResponsibleNotFound,
  newResponsibleInvalid,
} from '../pts.errors';

@Injectable()
export class PtsService {
  constructor(private readonly ptsRepository: PtsRepository) {}

  async createPts(dto: CreatePtsRequestDto, account: AccountContext) {
    const professional = await this.ptsRepository.findProfessionalById(
      dto.professionalId,
    );

    if (
      !professional ||
      (!isAdmin(account) && professional.accountId !== account.accountId)
    ) {
      throw professionalNotAuthorized();
    }

    if (!(await this.ptsRepository.patientExists(dto.patientId))) {
      throw patientNotFound();
    }

    if (await this.ptsRepository.hasApprovedActivePts(dto.patientId)) {
      throw ptsActiveExists();
    }

    const teamProfessionalIds = [
      ...new Set(dto.teamProfessionalIds ?? []),
    ].filter((id) => id !== dto.professionalId);

    const existingIds =
      await this.ptsRepository.findExistingProfessionalIds(teamProfessionalIds);

    const existingIdSet = new Set(existingIds);
    const missingIds = teamProfessionalIds.filter(
      (id) => !existingIdSet.has(id),
    );

    if (missingIds.length > 0) {
      throw teamProfessionalNotFound(missingIds);
    }

    return this.ptsRepository.createDraft({
      patientId: dto.patientId,
      responsibleProfessionalId: dto.professionalId,
      socialSituation: dto.socialSituation,
      teamProfessionalIds,
    });
  }

  async findDraftProposals(
    query: GetPtsProposalsQueryDto,
    account: AccountContext,
  ): Promise<GetPtsProposalsResponseDto> {
    const admin = isAdmin(account);
    const profileIds = account.professionalProfileIds;
    // Sem paciente na consulta, o paciente vê só as próprias propostas.
    const patientId =
      query.patientId ??
      (!admin && profileIds.length === 0 ? account.patientProfileId : null);
    const isPatient =
      account.patientProfileId !== null &&
      account.patientProfileId === patientId;

    if (!admin && !isPatient && profileIds.length === 0) {
      throw ptsProposalForbidden();
    }

    const result = await this.ptsRepository.findDraftProposals({
      accountId: account.accountId,
      patientId,
      q: query.q ?? null,
      isPatient,
      isAdmin: admin,
      professionalProfileIds: profileIds,
      page: query.page,
      limit: query.limit,
    });

    if (
      patientId &&
      !admin &&
      !isPatient &&
      result.total === 0 &&
      !(await this.ptsRepository.hasProposalRelation(patientId, profileIds))
    ) {
      throw ptsProposalForbidden();
    }

    // O paciente não vê a situação social (RN028).
    const rows = isPatient
      ? result.rows.map((row) => {
          const patientRow: Partial<typeof row> = { ...row };
          delete patientRow.socialSituation;
          return patientRow as typeof row;
        })
      : result.rows;

    return {
      data: rows,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit),
      },
    };
  }

  async findDraftProposalById(
    id: string,
    account: AccountContext,
  ): Promise<PtsProposalResponseDto> {
    const proposal = await this.ptsRepository.findDraftProposalById(id);

    if (!proposal) {
      throw ptsProposalNotFound();
    }

    const isPatientOwner =
      account.patientProfileId !== null &&
      proposal.patient.id === account.patientProfileId;

    const profileIds = account.professionalProfileIds;
    const isProfessionalOnProposal =
      profileIds.includes(proposal.responsible.id) ||
      proposal.team.some((member) => profileIds.includes(member.id));

    if (!isAdmin(account) && !isPatientOwner && !isProfessionalOnProposal) {
      throw ptsProposalForbidden();
    }

    return proposal;
  }

  async findActivePts(
    query: GetActivePtsQueryDto,
    account: AccountContext,
  ): Promise<ActivePtsResponseDto> {
    const admin = isAdmin(account);
    const isPatientOwner = account.patientProfileId === query.patientId;

    if (
      !admin &&
      !isPatientOwner &&
      account.professionalProfileIds.length === 0
    ) {
      throw activePtsForbidden();
    }

    const activePts = await this.ptsRepository.findActivePtsByPatientId(
      query.patientId,
    );

    if (!activePts) {
      if (admin || isPatientOwner) {
        throw activePtsNotFound();
      }

      throw activePtsForbidden();
    }

    const isProfessionalOnPts =
      account.professionalProfileIds.includes(activePts.responsible.id) ||
      activePts.team.some((member) =>
        account.professionalProfileIds.includes(member.id),
      );

    if (!admin && !isPatientOwner && !isProfessionalOnPts) {
      throw activePtsForbidden();
    }

    if (isPatientOwner) {
      const patientResponse = { ...activePts };
      delete patientResponse.socialSituation;
      return patientResponse;
    }

    return activePts;
  }

  /**
- Retorna um PTS em qualquer estado (RFPTS009). O admin vê todos (RN022); o
- paciente, os próprios, sem a situação social (RN028); o profissional, os
- de cuja equipe faz parte, menos o rejeitado (RN016).
   */
  async findPtsById(
    id: string,
    account: AccountContext,
  ): Promise<PtsDetailResponseDto> {
    const pts = await this.ptsRepository.findPtsById(id);

    if (!pts) {
      throw ptsNotFound();
    }

    if (isAdmin(account)) {
      return pts;
    }

    const profileIds = account.professionalProfileIds;
    const isProfessionalOnPts =
      pts.status !== PtsStateEnum.REJECTED &&
      (profileIds.includes(pts.responsible.id) ||
        pts.team.some((member) => profileIds.includes(member.id)));

    if (isProfessionalOnPts) {
      return pts;
    }

    if (account.patientProfileId === pts.patient.id) {
      const patientResponse = { ...pts };
      delete patientResponse.socialSituation;
      return patientResponse;
    }

    throw ptsForbidden();
  }

  async updatePtsProposal(
    id: string,
    dto: UpdatePtsProposalRequestDto,
    account: AccountContext,
  ): Promise<PtsProposalResponseDto> {
    if (
      dto.socialSituation === undefined &&
      dto.teamProfessionalIds === undefined
    ) {
      throw validationError([
        {
          field: 'body',
          message:
            'Informe socialSituation e/ou teamProfessionalIds para editar a proposta.',
        },
      ]);
    }

    const proposal = await this.ptsRepository.findProposalById(id);

    if (!proposal) {
      throw ptsProposalNotFound();
    }

    if (
      !isAdmin(account) &&
      !account.professionalProfileIds.includes(proposal.responsible.id)
    ) {
      throw ptsProposalEditForbidden();
    }

    if (proposal.status !== PtsStateEnum.DRAFT) {
      throw ptsProposalNotDraft();
    }

    let teamProfessionalIds: string[] | undefined;

    if (dto.teamProfessionalIds !== undefined) {
      teamProfessionalIds = [...new Set(dto.teamProfessionalIds)].filter(
        (professionalId) => professionalId !== proposal.responsible.id,
      );

      const existingIds =
        await this.ptsRepository.findExistingProfessionalIds(
          teamProfessionalIds,
        );
      const existingIdSet = new Set(existingIds);
      const missingIds = teamProfessionalIds.filter(
        (professionalId) => !existingIdSet.has(professionalId),
      );

      if (missingIds.length > 0) {
        throw teamProfessionalNotFound(missingIds);
      }
    }

    return this.ptsRepository.updateDraftProposal({
      id,
      socialSituation: dto.socialSituation,
      teamProfessionalIds,
    });
  }

  async updateSocialSituation(
    id: string,
    dto: UpdateSocialSituationRequestDto,
    account: AccountContext,
  ): Promise<UpdateSocialSituationResponseDto> {
    if (!dto.socialSituation?.trim()) {
      throw validationError([
        {
          field: 'socialSituation',
          message: 'A situação social é obrigatória.',
        },
      ]);
    }

    const pts = await this.ptsRepository.findSocialSituationTarget(id);

    if (!pts) {
      throw ptsNotFound();
    }

    const isProfessionalOnPts =
      account.professionalProfileIds.includes(pts.responsibleProfessionalId) ||
      pts.teamProfessionalIds.some((professionalId) =>
        account.professionalProfileIds.includes(professionalId),
      );

    if (!isAdmin(account) && !isProfessionalOnPts) {
      throw socialSituationForbidden();
    }

    if (
      pts.status !== PtsStateEnum.PLANNING &&
      pts.status !== PtsStateEnum.RUNNING
    ) {
      throw ptsNotActive();
    }

    return this.ptsRepository.updateSocialSituation(
      id,
      dto.socialSituation.trim(),
    );
  }

  async approveProposal(
    id: string,
    account: AccountContext,
  ): Promise<PtsDecisionResponseDto> {
    const proposal = await this.findDecidableProposal(id, account);

    if (await this.ptsRepository.hasApprovedActivePts(proposal.patientId)) {
      throw activePtsAlreadyExists();
    }

    return this.ptsRepository.approveProposal(id, proposal.patientId);
  }

  async rejectProposal(
    id: string,
    account: AccountContext,
  ): Promise<PtsDecisionResponseDto> {
    await this.findDecidableProposal(id, account);

    return this.ptsRepository.rejectProposal(id);
  }

  async deleteProposal(
    id: string,
    account: AccountContext,
  ): Promise<DeletePtsProposalResponseDto> {
    // Proposta já excluída não é encontrada: responde 404.
    const proposal = await this.ptsRepository.findProposalById(id);

    if (!proposal) {
      throw ptsProposalNotFound();
    }

    if (
      !isAdmin(account) &&
      !account.professionalProfileIds.includes(proposal.responsible.id)
    ) {
      throw ptsProposalDeleteForbidden();
    }

    // PTS aprovado não é excluído: é cancelado no encerramento (RFPTS010).
    if (proposal.status !== PtsStateEnum.DRAFT) {
      throw ptsProposalNotDraftForDelete();
    }

    await this.ptsRepository.softDeleteProposal(id);

    return { status: 'OK' };
  }

  async addTeamMembers(
    id: string,
    dto: AddPtsTeamMembersRequestDto,
    account: AccountContext,
  ): Promise<PtsTeamResponseDto> {
    const uniqueIds = [...new Set(dto.professionalIds)];

    if (
      uniqueIds.length === 0 ||
      uniqueIds.length !== dto.professionalIds.length
    ) {
      throw validationError([
        {
          field: 'professionalIds',
          message:
            'Informe ao menos um perfil profissional e sem IDs repetidos.',
        },
      ]);
    }

    const pts = await this.ptsRepository.findPtsTeamTarget(id);

    if (!pts) {
      throw ptsNotFound();
    }

    if (
      !isAdmin(account) &&
      !account.professionalProfileIds.includes(pts.responsibleProfessionalId)
    ) {
      throw teamEditForbidden();
    }

    if (
      pts.status !== PtsStateEnum.PLANNING &&
      pts.status !== PtsStateEnum.RUNNING
    ) {
      throw ptsNotActive();
    }

    const professionals =
      await this.ptsRepository.findProfessionalsWithAccountByIds(uniqueIds);

    const professionalMap = new Map(
      professionals.map((professional) => [professional.id, professional]),
    );

    const missingIds = uniqueIds.filter(
      (professionalId) => !professionalMap.has(professionalId),
    );

    if (missingIds.length > 0) {
      throw teamProfessionalNotFound(missingIds);
    }

    const existingAccountIds = new Set<string>([
      pts.responsibleAccountId,
      ...pts.teamMembers.map((member) => member.accountId),
    ]);

    const seenNewAccountIds = new Set<string>();
    const duplicateAccountProfessionalIds: string[] = [];

    for (const professionalId of uniqueIds) {
      const professional = professionalMap.get(professionalId)!;

      if (
        existingAccountIds.has(professional.accountId) ||
        seenNewAccountIds.has(professional.accountId)
      ) {
        duplicateAccountProfessionalIds.push(professionalId);
      } else {
        seenNewAccountIds.add(professional.accountId);
      }
    }

    if (duplicateAccountProfessionalIds.length > 0) {
      throw teamDuplicateAccount(duplicateAccountProfessionalIds);
    }

    const admin = isAdmin(account);
    const executorName =
      (await this.ptsRepository.findAccountDisplayName(account.accountId)) ??
      (admin ? 'Administrador' : pts.responsibleName);

    return this.ptsRepository.addTeamMembers({
      ptsId: id,
      members: uniqueIds.map((professionalId) => ({
        professionalId,
        description: `${executorName} adicionou ${professionalMap.get(professionalId)!.name} à equipe`,
      })),
      authorProfessionalId: admin ? null : pts.responsibleProfessionalId,
      executedByAccountId: account.accountId,
    });
  }

  async removeTeamMember(
    id: string,
    professionalId: string,
    account: AccountContext,
  ): Promise<PtsTeamResponseDto> {
    const pts = await this.ptsRepository.findPtsTeam(id);

    if (!pts) {
      throw ptsNotFound();
    }

    const admin = isAdmin(account);

    // RN006: só o responsável (ou o admin, RN022) altera a equipe.
    if (
      !admin &&
      !account.professionalProfileIds.includes(pts.responsible.id)
    ) {
      throw teamEditForbidden();
    }

    if (
      pts.status !== PtsStateEnum.PLANNING &&
      pts.status !== PtsStateEnum.RUNNING
    ) {
      throw ptsNotActive();
    }

    // RN007: a saída do responsável é feita pela transferência (RFEM002).
    if (professionalId === pts.responsible.id) {
      throw cannotRemoveResponsible();
    }

    const member = pts.team.find(
      (professional) => professional.id === professionalId,
    );

    if (!member) {
      throw teamMemberNotFound();
    }

    const executorName =
      (await this.ptsRepository.findAccountDisplayName(account.accountId)) ??
      (admin ? 'Administrador' : pts.responsible.name);

    return this.ptsRepository.removeTeamMember({
      ptsId: id,
      professionalId,
      authorProfessionalId: admin ? null : pts.responsible.id,
      executedByAccountId: account.accountId,
      description: `${executorName} removeu ${member.name} da equipe`,
    });
  }

  async transferResponsibility(
    id: string,
    dto: TransferPtsResponsibilityRequestDto,
    account: AccountContext,
  ): Promise<PtsTeamResponseDto> {
    const pts = await this.ptsRepository.findPtsTeamTarget(id);

    if (!pts) {
      throw ptsNotFound();
    }

    const admin = isAdmin(account);
    if (
      !admin &&
      !account.professionalProfileIds.includes(pts.responsibleProfessionalId)
    ) {
      throw teamEditForbidden();
    }

    if (
      pts.status !== PtsStateEnum.PLANNING &&
      pts.status !== PtsStateEnum.RUNNING
    ) {
      throw ptsNotActive();
    }

    const [newResponsible] =
      await this.ptsRepository.findProfessionalsWithAccountByIds([
        dto.newResponsibleId,
      ]);

    if (!newResponsible) {
      throw newResponsibleNotFound();
    }

    if (
      !newResponsible.accountId ||
      newResponsible.id === pts.responsibleProfessionalId
    ) {
      throw newResponsibleInvalid();
    }

    const hasDuplicateAccountInTeam = pts.teamMembers.some(
      (member) =>
        member.professionalId !== newResponsible.id &&
        member.accountId === newResponsible.accountId,
    );

    if (hasDuplicateAccountInTeam) {
      throw teamDuplicateAccount([newResponsible.id]);
    }

    const executorName =
      (await this.ptsRepository.findAccountDisplayName(account.accountId)) ??
      (admin ? 'Administrador' : pts.responsibleName);

    return this.ptsRepository.transferResponsibility({
      ptsId: id,
      newResponsibleId: newResponsible.id,
      authorProfessionalId: admin ? null : pts.responsibleProfessionalId,
      executedByAccountId: account.accountId,
      description: `${executorName} transferiu a responsabilidade do PTS para ${newResponsible.name}`,
    });
  }

  async startPts(
    id: string,
    account: AccountContext,
  ): Promise<PtsStartResponseDto> {
    const pts = await this.ptsRepository.findPtsTeamTarget(id);

    if (!pts) {
      throw ptsNotFound();
    }

    const admin = isAdmin(account);

    // RFPTS006: só o responsável (ou o admin, RN022) inicia a execução.
    if (
      !admin &&
      !account.professionalProfileIds.includes(pts.responsibleProfessionalId)
    ) {
      throw ptsStartForbidden();
    }

    if (pts.status !== PtsStateEnum.PLANNING) {
      throw ptsNotPlanning();
    }

    const executorName =
      (await this.ptsRepository.findAccountDisplayName(account.accountId)) ??
      (admin ? 'Administrador' : pts.responsibleName);

    return this.ptsRepository.startPts({
      ptsId: id,
      authorProfessionalId: admin ? null : pts.responsibleProfessionalId,
      executedByAccountId: account.accountId,
      description: `${executorName} iniciou a execução do PTS`,
    });
  }

  private async findDecidableProposal(id: string, account: AccountContext) {
    const proposal = await this.ptsRepository.findProposalForDecision(id);

    if (!proposal) {
      throw ptsProposalNotFound();
    }

    if (
      !isAdmin(account) &&
      (account.patientProfileId === null ||
        proposal.patientId !== account.patientProfileId)
    ) {
      throw ptsProposalForbidden();
    }

    if (proposal.status !== PtsStateEnum.DRAFT) {
      throw ptsProposalNotPending();
    }

    return proposal;
  }
}
