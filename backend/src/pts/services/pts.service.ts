import { Injectable } from '@nestjs/common';

import { CreatePtsRequestDto } from '../dto/create-pts.dto';
import type { GetPtsProposalsQueryDto } from '../dto/get-pts-proposals-query.dto';
import type {
  GetPtsProposalsResponseDto,
  PtsProposalResponseDto,
} from '../dto/pts-proposal-response.dto';
import { PtsRepository } from '../repositories/pts.repository';
import type { AccountContext } from '../../accounts/services/accounts.service';
import {
  patientNotFound,
  professionalNotAuthorized,
  ptsActiveExists,
  ptsProposalForbidden,
  ptsProposalNotFound,
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
}
