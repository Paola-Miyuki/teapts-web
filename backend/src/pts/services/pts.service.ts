import { Injectable } from '@nestjs/common';
import { PtsRepository, CreateDraftInput } from '../repositories/pts.repository';
import { PtsEntity } from '../entities/pts.entity';

@Injectable()
export class PtsService {
  constructor(private readonly ptsRepository: PtsRepository) {}

  async createDraft(dto: CreateDraftInput): Promise<PtsEntity> {
    return await this.ptsRepository.createDraft({
      patientId: dto.patientId,
      responsibleProfessionalId: dto.responsibleProfessionalId,
      socialSituation: dto.socialSituation,
      teamProfessionalIds: dto.teamProfessionalIds ?? [],
    });
  }

  async findById(id: string): Promise<PtsEntity | null> {
    return await this.ptsRepository.findPtsById(id);
  }

  async findByPatientId(
    patientId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    return await this.ptsRepository.findProposalsByPatientId(
      patientId,
      page,
      limit,
    );
  }
}