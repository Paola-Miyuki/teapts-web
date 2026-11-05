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
  type UpdatePtsProposalInput,
  type SocialSituationTarget,
  type ProposalDecisionTarget,
} from './pts.repository';
import type { PtsProposalResponseDto } from '../dto/pts-proposal-response.dto';
import type { ActivePtsResponseDto } from '../dto/active-pts-response.dto';
import type { UpdateSocialSituationResponseDto } from '../dto/update-social-situation.dto';
import type { PtsDecisionResponseDto } from '../dto/pts-decision-response.dto';
import { PtsEntity } from '../entities/pts.entity';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import { Professional } from '../../professionals/entities/professional.entity';
import { Specialism } from '../../professionals/enums/specialism.enum';
import { Patient } from '../../patients/entities/patient.entity';
import {
  activePtsAlreadyExists,
  ptsProposalNotDraft,
  ptsProposalNotPending,
} from '../pts.errors';

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

  async findActivePtsByPatientId(
    patientId: string,
  ): Promise<ActivePtsResponseDto | null> {
    const pts = await this.ptsRepository
      .createQueryBuilder('pts')
      .leftJoinAndSelect('pts.patient', 'patient')
      .leftJoinAndSelect('patient.account', 'patientAccount')
      .leftJoinAndSelect('pts.responsible', 'responsible')
      .leftJoinAndSelect('responsible.account', 'responsibleAccount')
      .leftJoinAndSelect('pts.team', 'team')
      .leftJoinAndSelect('team.account', 'teamAccount')
      .where('pts.patientId = :patientId', { patientId })
      .andWhere('pts.status IN (:...statuses)', {
        statuses: [PtsStateEnum.PLANNING, PtsStateEnum.RUNNING],
      })
      .orderBy('pts.createdAt', 'DESC')
      .addOrderBy('pts.id', 'DESC')
      .getOne();

    return pts ? this.toActiveResponse(pts) : null;
  }

  async findProposalById(id: string): Promise<PtsProposalResponseDto | null> {
    const proposal = await this.ptsRepository
      .createQueryBuilder('proposal')
      .leftJoinAndSelect('proposal.patient', 'patient')
      .leftJoinAndSelect('patient.account', 'patientAccount')
      .leftJoinAndSelect('proposal.responsible', 'responsible')
      .leftJoinAndSelect('responsible.account', 'responsibleAccount')
      .leftJoinAndSelect('proposal.team', 'team')
      .leftJoinAndSelect('team.account', 'teamAccount')
      .where('proposal.id = :id', { id })
      .getOne();

    return proposal ? this.toProposalResponse(proposal) : null;
  }

  async updateDraftProposal(
    input: UpdatePtsProposalInput,
  ): Promise<PtsProposalResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();

    try {
      await queryRunner.startTransaction();

      const locked = await queryRunner.manager
        .createQueryBuilder(PtsEntity, 'pts')
        .setLock('pessimistic_write')
        .where('pts.id = :id', { id: input.id })
        .getOne();

      if (locked?.status !== PtsStateEnum.DRAFT) {
        throw ptsProposalNotDraft();
      }

      const update: Partial<PtsEntity> = {};

      if (input.socialSituation !== undefined) {
        update.socialSituation = input.socialSituation;
      }

      if (Object.keys(update).length > 0) {
        await queryRunner.manager.update(PtsEntity, input.id, update);
      }

      if (input.teamProfessionalIds !== undefined) {
        await queryRunner.query(
          `DELETE FROM professional_participating_on_therapeutic_journey
           WHERE therapeutic_journey_id = $1`,
          [input.id],
        );

        for (const professionalId of input.teamProfessionalIds) {
          await queryRunner.query(
            `INSERT INTO professional_participating_on_therapeutic_journey
              (professional_id, therapeutic_journey_id)
             VALUES ($1, $2)`,
            [professionalId, input.id],
          );
        }
      }

      const proposal = await queryRunner.manager.findOne(PtsEntity, {
        where: { id: input.id },
        relations: {
          patient: { account: true },
          responsible: { account: true },
          team: { account: true },
        },
      });

      if (!proposal) {
        throw new Error('Erro ao recuperar a proposta de PTS atualizada.');
      }

      await queryRunner.commitTransaction();

      return this.toProposalResponse(proposal);
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }

      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findSocialSituationTarget(
    id: string,
  ): Promise<SocialSituationTarget | null> {
    const pts = await this.ptsRepository.findOne({
      where: { id },
      relations: { team: true },
    });

    if (!pts) {
      return null;
    }

    return {
      id: pts.id,
      status: pts.status,
      responsibleProfessionalId: pts.responsibleProfessionalId,
      teamProfessionalIds: (pts.team ?? []).map(
        (professional) => professional.id,
      ),
    };
  }

  async updateSocialSituation(
    id: string,
    socialSituation: string,
  ): Promise<UpdateSocialSituationResponseDto> {
    await this.ptsRepository.update(id, { socialSituation });

    return { id, socialSituation };
  }

  async findProposalForDecision(
    id: string,
  ): Promise<ProposalDecisionTarget | null> {
    const pts = await this.ptsRepository.findOne({
      where: { id },
      select: { id: true, status: true, patientId: true },
    });

    if (!pts) {
      return null;
    }

    return {
      id: pts.id,
      status: pts.status as PtsStateEnum,
      patientId: pts.patientId,
    };
  }

  async approveProposal(
    id: string,
    patientId: string,
  ): Promise<PtsDecisionResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();

    try {
      await queryRunner.startTransaction();

      // Trava todos os PTS do paciente, sempre na mesma ordem: duas decisões
      // simultâneas esperam uma pela outra e não terminam com dois PTS ativos.
      const patientPts = await queryRunner.manager
        .createQueryBuilder(PtsEntity, 'pts')
        .setLock('pessimistic_write')
        .where('pts.patientId = :patientId', { patientId })
        .orderBy('pts.id')
        .getMany();

      const proposal = patientPts.find((pts) => pts.id === id);

      if (proposal?.status !== PtsStateEnum.DRAFT) {
        throw ptsProposalNotPending();
      }

      if (
        patientPts.some(
          (pts) =>
            pts.status === PtsStateEnum.PLANNING ||
            pts.status === PtsStateEnum.RUNNING,
        )
      ) {
        throw activePtsAlreadyExists();
      }

      const now = new Date();
      const otherDraftIds = patientPts
        .filter((pts) => pts.id !== id && pts.status === PtsStateEnum.DRAFT)
        .map((pts) => pts.id);

      await queryRunner.manager.update(PtsEntity, id, {
        status: PtsStateEnum.PLANNING,
        acceptedAt: now,
      });

      if (otherDraftIds.length > 0) {
        await queryRunner.manager.update(
          PtsEntity,
          { id: In(otherDraftIds) },
          { status: PtsStateEnum.REJECTED, rejectedAt: now },
        );
      }

      await queryRunner.commitTransaction();

      return {
        id,
        status: PtsStateEnum.PLANNING,
        acceptedAt: now.toISOString(),
        rejectedAt: null,
      };
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async rejectProposal(id: string): Promise<PtsDecisionResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();

    try {
      await queryRunner.startTransaction();

      const locked = await queryRunner.manager
        .createQueryBuilder(PtsEntity, 'pts')
        .setLock('pessimistic_write')
        .where('pts.id = :id', { id })
        .getOne();

      if (locked?.status !== PtsStateEnum.DRAFT) {
        throw ptsProposalNotPending();
      }

      const now = new Date();

      await queryRunner.manager.update(PtsEntity, id, {
        status: PtsStateEnum.REJECTED,
        rejectedAt: now,
      });

      await queryRunner.commitTransaction();

      return {
        id,
        status: PtsStateEnum.REJECTED,
        acceptedAt: null,
        rejectedAt: now.toISOString(),
      };
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private toProposalResponse(proposal: PtsEntity): PtsProposalResponseDto {
    return {
      id: proposal.id,
      status: proposal.status,
      socialSituation: proposal.socialSituation,
      createdAt: proposal.createdAt.toISOString(),
      patient: {
        id: proposal.patient.accountId,
        name: proposal.patient.account?.name ?? '',
      },
      responsible: this.mapProfessional(proposal.responsible),
      team: (proposal.team ?? []).map((professional) =>
        this.mapProfessional(professional),
      ),
    };
  }

  private toActiveResponse(pts: PtsEntity): ActivePtsResponseDto {
    return {
      id: pts.id,
      status: pts.status as PtsStateEnum.PLANNING | PtsStateEnum.RUNNING,
      socialSituation: pts.socialSituation,
      createdAt: pts.createdAt.toISOString(),
      acceptedAt: pts.acceptedAt?.toISOString() ?? null,
      beganAt: pts.beganAt?.toISOString() ?? null,
      patient: {
        id: pts.patient.accountId,
        name: pts.patient.account?.name ?? '',
      },
      responsible: this.mapProfessional(pts.responsible),
      team: (pts.team ?? []).map((professional) =>
        this.mapProfessional(professional),
      ),
    };
  }

  private mapProfessional(professional: Professional) {
    const specialismNames: Record<Specialism, string> = {
      [Specialism.Psychologist]: 'Psicologia',
      [Specialism.Doctor]: 'Medicina',
      [Specialism.Physiotherapist]: 'Fisioterapia',
    };

    return {
      id: professional.id,
      name: professional.account?.name ?? '',
      specialism: {
        id: String(professional.specialism),
        name:
          specialismNames[professional.specialism] ??
          String(professional.specialism),
      },
    };
  }
}
