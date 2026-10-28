import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PtsEntity } from '../entities/pts.entity';
import { PtsRepository, CreateDraftInput } from './pts.repository';

@Injectable()
export class PtsRepositoryImpl implements PtsRepository {
  constructor(
    @InjectRepository(PtsEntity)
    private readonly ptsRepository: Repository<PtsEntity>,
  ) {}

  async createDraft(input: CreateDraftInput): Promise<PtsEntity> {
    const pts = this.ptsRepository.create({
      patientId: input.patientId,
      responsibleProfessionalId: input.responsibleProfessionalId,
      socialSituation: input.socialSituation,
      status: 'draft',
    });

    return await this.ptsRepository.save(pts);
  }

  async findPtsById(id: string): Promise<PtsEntity | null> {
    return await this.ptsRepository.findOne({
      where: { id },
    });
  }

  async findProposalsByPatientId(
    patientId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: PtsEntity[]; total: number }> {
    const [data, total] = await this.ptsRepository.findAndCount({
      where: { patientId },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { data, total };
  }
}
