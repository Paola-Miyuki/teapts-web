import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Brackets,
  DataSource,
  In,
  Repository,
  type SelectQueryBuilder,
} from 'typeorm';

import { CreatePtsResponseDto } from '../dto/create-pts.dto';
import {
  PtsRepository,
  type FindPtsProposalsInput,
  type FindPtsProposalsResult,
  type CreateDraftInput,
  type ProfessionalRecord,
} from './pts.repository';
import type { PtsProposalResponseDto } from '../dto/pts-proposal-response.dto';
import { PtsEntity } from '../entities/pts.entity';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import { Professional } from '../../professionals/entities/professional.entity';
import { Specialism } from '../../professionals/enums/specialism.enum';
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

  async findProfessionalById(id: string): Promise<ProfessionalRecord | null> {
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

  async createDraft(input: CreateDraftInput): Promise<CreatePtsResponseDto> {
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
        status: fullPts.status,
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

  async findDraftProposals(
    input: FindPtsProposalsInput,
  ): Promise<FindPtsProposalsResult> {
    const { patientId, isPatient, professionalProfileIds, page, limit } = input;

    const query = this.ptsRepository
      .createQueryBuilder('proposal')
      .leftJoinAndSelect('proposal.patient', 'patient')
      .leftJoinAndSelect('patient.account', 'patientAccount')
      .leftJoinAndSelect('proposal.responsible', 'responsible')
      .leftJoinAndSelect('responsible.account', 'responsibleAccount')
      .leftJoinAndSelect('proposal.team', 'team')
      .leftJoinAndSelect('team.account', 'teamAccount')
      .where('proposal.patientId = :patientId', { patientId })
      .andWhere('proposal.status = :status', {
        status: PtsStateEnum.DRAFT,
      });

    if (!isPatient) {
      this.restrictToProfessionals(query, 'proposal', professionalProfileIds);
    }

    const [proposals, total] = await query
      .orderBy('proposal.createdAt', 'DESC')
      .addOrderBy('proposal.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      rows: proposals.map((proposal) => this.toProposalResponse(proposal)),
      total,
    };
  }

  async hasProposalRelation(
    patientId: string,
    profileIds: string[],
  ): Promise<boolean> {
    if (profileIds.length === 0) {
      return false;
    }

    const query = this.ptsRepository
      .createQueryBuilder('related')
      .where('related.patientId = :patientId', { patientId });

    this.restrictToProfessionals(query, 'related', profileIds);

    return (await query.getCount()) > 0;
  }

  private restrictToProfessionals(
    query: SelectQueryBuilder<PtsEntity>,
    alias: string,
    profileIds: string[],
  ): void {
    query.andWhere(
      new Brackets((qb) => {
        qb.where(`${alias}.responsibleProfessionalId IN (:...profileIds)`, {
          profileIds,
        }).orWhere(
          `EXISTS (
            SELECT 1
            FROM professional_participating_on_therapeutic_journey participation
            WHERE participation.therapeutic_journey_id = ${alias}.id
              AND participation.professional_id IN (:...profileIds)
          )`,
          { profileIds },
        );
      }),
    );
  }

  async findDraftProposalById(
    id: string,
  ): Promise<PtsProposalResponseDto | null> {
    const proposal = await this.ptsRepository
      .createQueryBuilder('proposal')
      .leftJoinAndSelect('proposal.patient', 'patient')
      .leftJoinAndSelect('patient.account', 'patientAccount')
      .leftJoinAndSelect('proposal.responsible', 'responsible')
      .leftJoinAndSelect('responsible.account', 'responsibleAccount')
      .leftJoinAndSelect('proposal.team', 'team')
      .leftJoinAndSelect('team.account', 'teamAccount')
      .where('proposal.id = :id', { id })
      .andWhere('proposal.status = :status', {
        status: PtsStateEnum.DRAFT,
      })
      .getOne();

    return proposal ? this.toProposalResponse(proposal) : null;
  }

  private toProposalResponse(proposal: PtsEntity): PtsProposalResponseDto {
    const specialismNames: Record<Specialism, string> = {
      [Specialism.Psychologist]: 'Psicologia',
      [Specialism.Doctor]: 'Medicina',
      [Specialism.Physiotherapist]: 'Fisioterapia',
    };

    const mapProfessional = (professional: Professional) => ({
      id: professional.id,
      name: professional.account?.name ?? '',
      specialism: {
        id: String(professional.specialism),
        name:
          specialismNames[professional.specialism] ??
          String(professional.specialism),
      },
    });

    return {
      id: proposal.id,
      status: proposal.status,
      socialSituation: proposal.socialSituation,
      createdAt: proposal.createdAt.toISOString(),
      patient: {
        id: proposal.patient.accountId,
        name: proposal.patient.account?.name ?? '',
      },
      responsible: mapProfessional(proposal.responsible),
      team: (proposal.team ?? []).map(mapProfessional),
    };
  }
}
