
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

import { CreatePtsResponseDto } from '../dto/create-pts.dto';
import {
  CreateDraftInput,
  ProfessionalRecord,
  PtsRepository,
} from './pts.repository';
import { PtsEntity } from '../entities/pts.entity';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import { Professional } from '../../professionals/entities/professional.entity';
import { Patient } from '../../patients/entities/patient.entity';

@Injectable()
export class PtsRepositoryImpl extends PtsRepository {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(PtsEntity)
    private readonly ptsRepository: Repository<PtsEntity>,
    @InjectRepository(Professional)
    private readonly professionalRepository: Repository<Professional>,
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
  ) {
    super();
  }

  async findProfessionalById(
    id: string,
  ): Promise<ProfessionalRecord | null> {
    const professional = await this.professionalRepository.findOne({
      where: { id },
      relations: {
        account: true,
      },
    });

    if (!professional) {
      return null;
    }

    return {
      id: professional.id,
      accountId: professional.account?.id ?? '',
    };
  }

  async patientExists(id: string): Promise<boolean> {
    const count = await this.patientRepository.count({
      where: { accountId: id },
    });

    return count > 0;
  }

  async hasApprovedActivePts(patientId: string): Promise<boolean> {
    const count = await this.ptsRepository.count({
      where: {
        patientId,
        status: In([PtsStateEnum.PLANNING, PtsStateEnum.RUNNING]),
      },
    });

    return count > 0;
  }

  async findExistingProfessionalIds(ids: string[]): Promise<string[]> {
    if (ids.length === 0) {
      return [];
    }

    const found = await this.professionalRepository.find({
      where: { id: In(ids) },
    });

    return found.map((professional) => professional.id);
  }

  async createDraft(
    input: CreateDraftInput,
  ): Promise<CreatePtsResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();

    try {
      await queryRunner.startTransaction();

      const pts = queryRunner.manager.create(PtsEntity, {
        socialSituation: input.socialSituation,
        status: PtsStateEnum.DRAFT,
        patientId: input.patientId,
        responsibleProfessionalId: input.responsibleProfessionalId,
      });

      const savedPts = await queryRunner.manager.save(PtsEntity, pts);

      const uniqueTeamIds = [
        ...new Set(input.teamProfessionalIds ?? []),
      ].filter((id) => id !== input.responsibleProfessionalId);

      for (const professionalId of uniqueTeamIds) {
        await queryRunner.query(
          `INSERT INTO professional_participating_on_therapeutic_journey
            (professional_id, therapeutic_journey_id)
           VALUES ($1, $2)`,
          [professionalId, savedPts.id],
        );
      }

      const fullPts = await queryRunner.manager.findOne(PtsEntity, {
        where: { id: savedPts.id },
        relations: {
          patient: { account: true },
          responsible: { account: true },
          team: { account: true },
        },
      });

      if (!fullPts) {
        throw new Error('Erro ao recuperar o PTS recém-criado.');
      }

      const response: CreatePtsResponseDto = {
        id: fullPts.id,
        status: fullPts.status.toUpperCase() as CreatePtsResponseDto['status'],
        socialSituation: fullPts.socialSituation,
        createdAt: fullPts.createdAt.toISOString(),
        patient: {
          id: fullPts.patient.accountId,
          name: fullPts.patient.account?.name ?? '',
        },
        responsible: {
          id: fullPts.responsible.id,
          name: fullPts.responsible.account?.name ?? '',
          specialism: {
            id: String(fullPts.responsible.specialism),
            name: String(fullPts.responsible.specialism),
          },
        },
        team: (fullPts.team ?? []).map((professional) => ({
          id: professional.id,
          name: professional.account?.name ?? '',
          specialism: {
            id: String(professional.specialism),
            name: String(professional.specialism),
          },
        })),
      };

      await queryRunner.commitTransaction();

      return response;
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }

      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
