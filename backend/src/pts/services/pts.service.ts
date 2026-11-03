import { Injectable } from '@nestjs/common';

import { CreatePtsRequestDto } from '../dto/create-pts.dto';
import type { GetPtsProposalsQueryDto } from '../dto/get-pts-proposals-query.dto';
import type {
  GetPtsProposalsResponseDto,
  PtsProposalResponseDto,
} from '../dto/pts-proposal-response.dto';
import type { GetActivePtsQueryDto } from '../dto/get-active-pts-query.dto';
import type { ActivePtsResponseDto } from '../dto/active-pts-response.dto';
import type {
  UpdateSocialSituationRequestDto,
  UpdateSocialSituationResponseDto,
} from '../dto/update-social-situation.dto';
import { PtsRepository } from '../repositories/pts.repository';
import type { AccountContext } from '../../accounts/services/accounts.service';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import {
  patientNotFound,
  professionalNotAuthorized,
  ptsActiveExists,
  ptsProposalForbidden,
  ptsProposalNotFound,
  activePtsForbidden,
  activePtsNotFound,
  ptsNotFound,
  socialSituationForbidden,
  ptsNotActive,
  validationError,
  teamProfessionalNotFound,
} from '../pts.errors';

@Injectable()
export class PtsService {
  constructor(private readonly ptsRepository: PtsRepository) {}

  async createPts(dto: CreatePtsRequestDto, currentAccountId: string) {
    const professional = await this.ptsRepository.findProfessionalById(
      dto.professionalId,
    );

    if (!professional || professional.accountId !== currentAccountId) {
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
    const isPatient = account.patientProfileId === query.patientId;
    const profileIds = account.professionalProfileIds;

    if (!isPatient && profileIds.length === 0) {
      throw ptsProposalForbidden();
    }

    const result = await this.ptsRepository.findDraftProposals({
      accountId: account.accountId,
      patientId: query.patientId,
      isPatient,
      professionalProfileIds: profileIds,
      page: query.page,
      limit: query.limit,
    });

    if (
      !isPatient &&
      result.total === 0 &&
      !(await this.ptsRepository.hasProposalRelation(
        query.patientId,
        profileIds,
      ))
    ) {
      throw ptsProposalForbidden();
    }

    return {
      data: result.rows,
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

    if (!isPatientOwner && !isProfessionalOnProposal) {
      throw ptsProposalForbidden();
    }

    return proposal;
  }

  async findActivePts(
    query: GetActivePtsQueryDto,
    account: AccountContext,
  ): Promise<ActivePtsResponseDto> {
    const isPatientOwner = account.patientProfileId === query.patientId;

    if (!isPatientOwner && account.professionalProfileIds.length === 0) {
      throw activePtsForbidden();
    }

    const activePts = await this.ptsRepository.findActivePtsByPatientId(
      query.patientId,
    );

    if (!activePts) {
      if (isPatientOwner) {
        throw activePtsNotFound();
      }

      throw activePtsForbidden();
    }

    const isProfessionalOnPts =
      account.professionalProfileIds.includes(activePts.responsible.id) ||
      activePts.team.some((member) =>
        account.professionalProfileIds.includes(member.id),
      );

    if (!isPatientOwner && !isProfessionalOnPts) {
      throw activePtsForbidden();
    }

    if (isPatientOwner) {
      const patientResponse = { ...activePts };
      delete patientResponse.socialSituation;
      return patientResponse;
    }

    return activePts;
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

    if (!isProfessionalOnPts) {
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
}
