
import { Injectable } from '@nestjs/common';
import { CreatePtsRequestDto } from '../dto/create-pts.dto';
import { PtsRepository } from '../repositories/pts.repository';
import {
  patientNotFound,
  professionalNotAuthorized,
  ptsActiveExists,
  teamProfessionalNotFound,
} from '../pts.errors';

@Injectable()
export class PtsService {
  constructor(private readonly ptsRepository: PtsRepository) {}

  async createPts(dto: CreatePtsRequestDto, currentAccountId: string) {
    const professional = await this.ptsRepository.findProfessionalById(
      dto.professionalId,
    );

    if (
      !professional ||
      professional.accountId !== currentAccountId
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
      await this.ptsRepository.findExistingProfessionalIds(
        teamProfessionalIds,
      );

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
}
