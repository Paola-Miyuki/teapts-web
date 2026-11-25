import { escapeLike } from '../../common/search/escape-like';
import {
  SPECIALISM_NAMES,
  toProfessionalRegistration,
} from '../../professionals/professional-registration';
import type { PtsDetailResponseDto } from '../dto/pts-detail-response.dto';
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
  type FindPtsListInput,
  type FindPtsListResult,
  type CreateDraftInput,
  type ProfessionalRecord,
  type UpdatePtsProposalInput,
  type PtsSheetTarget,
  type UpdatePtsSheetInput,
  type ProposalDecisionTarget,
  type PtsTeamTarget,
  type ProfessionalAccountRecord,
  type RemoveTeamMemberInput,
  type AddTeamMembersInput,
  type TransferResponsibilityInput,
  type ClosePtsInput,
  type StartPtsInput,
  type FindPtsHistoryInput,
  type FindPtsHistoryResult,
} from './pts.repository';
import type { PtsHistoryItemDto } from '../dto/pts-history.dto';
import type { PtsListItemResponseDto } from '../dto/pts-list-response.dto';
import type { ClosePtsResponseDto } from '../dto/close-pts.dto';
import type { PtsStartResponseDto } from '../dto/pts-start-response.dto';
import type { PtsTeamResponseDto } from '../dto/pts-team-response.dto';
import type { PtsProposalResponseDto } from '../dto/pts-proposal-response.dto';
import type { ActivePtsResponseDto } from '../dto/active-pts-response.dto';
import type { UpdatePtsSheetResponseDto } from '../dto/update-pts-sheet.dto';
import type { PtsDecisionResponseDto } from '../dto/pts-decision-response.dto';
import { ActivityEntity } from '../../activities/entities/activity.entity';
import { ActivityState } from '../../activities/enums/activity.enums';
import { AccountStatus } from '../../accounts/enums/account-status.enum';
import { PtsEntity } from '../entities/pts.entity';
import { Account } from '../../accounts/entities/account.entity';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import { Professional } from '../../professionals/entities/professional.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { TimelineRecordTarget } from '../../timeline/enums/timeline-record-target.enum';
import { TimelineRecordType } from '../../timeline/enums/timeline-record-type.enum';
import { TimelineRecorderService } from '../../timeline/services/timeline-recorder.service';
import {
  activePtsAlreadyExists,
  cannotRemoveResponsible,
  ptsCloseForbidden,
  ptsCloseNotActive,
  ptsNotActive,
  ptsNotFound,
  ptsNotPlanning,
  ptsStartForbidden,
  ptsProposalNotDraft,
  ptsProposalNotDraftForDelete,
  ptsProposalNotFound,
  ptsProposalNotPending,
  teamEditForbidden,
  teamMemberNotFound,
  newResponsibleNotFound,
  newResponsibleInvalid,
  teamDuplicateAccount,
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
    private readonly timelineRecorder: TimelineRecorderService,
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

    // Profissional de conta desativada sai da seleção de equipes (RFAUT005).
    const found = await this.professionalRepository.find({
      where: { id: In(ids), account: { status: AccountStatus.Active } },
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
        responsible: this.mapProfessional(fullPts.responsible),
        team: (fullPts.team ?? []).map((professional) =>
          this.mapProfessional(professional),
        ),
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
    const {
      patientId,
      q,
      isPatient,
      isAdmin,
      professionalProfileIds,
      page,
      limit,
    } = input;

    const query = this.ptsRepository
      .createQueryBuilder('proposal')
      .leftJoinAndSelect('proposal.patient', 'patient')
      .leftJoinAndSelect('patient.account', 'patientAccount')
      .leftJoinAndSelect('proposal.responsible', 'responsible')
      .leftJoinAndSelect('responsible.account', 'responsibleAccount')
      .leftJoinAndSelect('proposal.team', 'team')
      .leftJoinAndSelect('team.account', 'teamAccount')
      .where('proposal.status = :status', {
        status: PtsStateEnum.DRAFT,
      });

    if (patientId) {
      query.andWhere('proposal.patientId = :patientId', { patientId });
    }

    if (q) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('patientAccount.name ILIKE :term', {
            term: `%${escapeLike(q)}%`,
          }).orWhere('patientAccount.socialName ILIKE :term');
        }),
      );
    }

    if (!isPatient && !isAdmin) {
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

  async findPtsList(input: FindPtsListInput): Promise<FindPtsListResult> {
    const query = this.ptsRepository
      .createQueryBuilder('pts')
      .innerJoin('pts.patient', 'patient')
      .innerJoin('patient.account', 'patientAccount');

    if (input.professionalProfileIds) {
      this.restrictToProfessionals(query, 'pts', input.professionalProfileIds);
    }

    if (input.q) {
      const term = `%${escapeLike(input.q)}%`;

      query.andWhere(
        new Brackets((qb) => {
          qb.where('patientAccount.name ILIKE :term', { term })
            .orWhere('patientAccount.socialName ILIKE :term')
            .orWhere('patient.cns ILIKE :term');
        }),
      );
    }

    if (input.status) {
      query.andWhere('pts.status IN (:...statuses)', {
        statuses: input.status,
      });
    }

    if (input.responsibleId) {
      query.andWhere('pts.responsibleProfessionalId = :responsibleId', {
        responsibleId: input.responsibleId,
      });
    }

    if (input.memberId) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('pts.responsibleProfessionalId = :memberId', {
            memberId: input.memberId,
          }).orWhere(
            `EXISTS (
              SELECT 1
              FROM professional_participating_on_therapeutic_journey participation
              WHERE participation.therapeutic_journey_id = pts.id
                AND participation.professional_id = :memberId
            )`,
          );
        }),
      );
    }

    if (input.createdFrom) {
      query.andWhere('pts.createdAt >= CAST(:createdFrom AS date)', {
        createdFrom: input.createdFrom,
      });
    }

    if (input.createdTo) {
      query.andWhere('pts.createdAt < CAST(:createdTo AS date) + 1', {
        createdTo: input.createdTo,
      });
    }

    const total = await query.clone().getCount();
    const direction = input.order === 'asc' ? 'ASC' : 'DESC';

    // Ordem do ciclo: proposta, planejamento, andamento, encerrados.
    const statusRank = `CASE pts.status
      WHEN '${PtsStateEnum.DRAFT}' THEN 1
      WHEN '${PtsStateEnum.PLANNING}' THEN 2
      WHEN '${PtsStateEnum.RUNNING}' THEN 3
      WHEN '${PtsStateEnum.CONCLUDED}' THEN 4
      WHEN '${PtsStateEnum.CANCELLED}' THEN 5
      ELSE 6
    END`;

    const idsQuery = query
      .clone()
      .select('pts.id', 'id')
      .addSelect(statusRank, 'status_rank')
      .addSelect('pts.createdAt', 'created_at');

    if (input.sort === 'status') {
      idsQuery
        .orderBy('status_rank', direction)
        .addOrderBy('created_at', 'DESC');
    } else {
      idsQuery.orderBy('created_at', direction);
    }

    const idRows = await idsQuery
      .addOrderBy('pts.id', direction)
      .offset((input.page - 1) * input.limit)
      .limit(input.limit)
      .getRawMany<{ id: string }>();
    const ids = idRows.map((row) => row.id);

    if (ids.length === 0) {
      return { rows: [], total };
    }

    const loaded = await this.ptsRepository.find({
      where: { id: In(ids) },
      relations: {
        patient: { account: true },
        responsible: { account: true },
        team: { account: true },
      },
    });
    const byId = new Map(loaded.map((pts) => [pts.id, pts]));
    const patientIds = [...new Set(loaded.map((pts) => pts.patientId))];

    // A versão conta todos os PTS do paciente, não só os da página.
    const versionRows = await this.ptsRepository
      .createQueryBuilder('versioned')
      .select('versioned.id', 'id')
      .addSelect(
        'ROW_NUMBER() OVER (PARTITION BY versioned.patientId ORDER BY versioned.createdAt ASC, versioned.id ASC)',
        'version',
      )
      .where('versioned.patientId IN (:...patientIds)', { patientIds })
      .getRawMany<{ id: string; version: string }>();
    const versions = new Map(
      versionRows.map((row) => [row.id, Number(row.version)]),
    );

    return {
      rows: ids.flatMap((id) => {
        const pts = byId.get(id);

        return pts ? [this.toListItem(pts, versions)] : [];
      }),
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

  async findPtsById(id: string): Promise<PtsDetailResponseDto | null> {
    const pts = await this.ptsRepository
      .createQueryBuilder('pts')
      .leftJoinAndSelect('pts.patient', 'patient')
      .leftJoinAndSelect('patient.account', 'patientAccount')
      .leftJoinAndSelect('pts.responsible', 'responsible')
      .leftJoinAndSelect('responsible.account', 'responsibleAccount')
      .leftJoinAndSelect('pts.team', 'team')
      .leftJoinAndSelect('team.account', 'teamAccount')
      .where('pts.id = :id', { id })
      .getOne();

    return pts ? this.toDetailResponse(pts) : null;
  }

  async findPtsHistory(
    input: FindPtsHistoryInput,
  ): Promise<FindPtsHistoryResult> {
    const query = this.ptsRepository
      .createQueryBuilder('pts')
      .leftJoinAndSelect('pts.responsible', 'responsible')
      .leftJoinAndSelect('responsible.account', 'responsibleAccount')
      .leftJoinAndSelect('pts.team', 'team')
      .leftJoinAndSelect('team.account', 'teamAccount')
      .where('pts.patientId = :patientId', { patientId: input.patientId });

    if (input.professionalProfileIds.length > 0) {
      query.andWhere(
        new Brackets((where) => {
          where
            .where('pts.responsibleProfessionalId IN (:...profileIds)', {
              profileIds: input.professionalProfileIds,
            })
            .orWhere('team.id IN (:...profileIds)', {
              profileIds: input.professionalProfileIds,
            });
        }),
      );
    }

    const [ptsRows, total] = await query
      .orderBy('pts.createdAt', 'DESC')
      .addOrderBy('pts.id', 'DESC')
      .skip((input.page - 1) * input.limit)
      .take(input.limit)
      .getManyAndCount();

    const versionRows = await this.ptsRepository
      .createQueryBuilder('versioned')
      .select('versioned.id', 'id')
      .addSelect(
        'ROW_NUMBER() OVER (ORDER BY versioned.createdAt ASC, versioned.id ASC)',
        'version',
      )
      .where('versioned.patientId = :patientId', {
        patientId: input.patientId,
      })
      .orderBy('versioned.createdAt', 'ASC')
      .addOrderBy('versioned.id', 'ASC')
      .getRawMany<{ id: string; version: string }>();
    const versions = new Map(
      versionRows.map((row) => [row.id, Number(row.version)]),
    );

    return {
      rows: ptsRows.map((pts) => this.toHistoryItem(pts, versions)),
      total,
    };
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

  async findSheetTarget(id: string): Promise<PtsSheetTarget | null> {
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

  async updateSheet(
    input: UpdatePtsSheetInput,
  ): Promise<UpdatePtsSheetResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();

    try {
      await queryRunner.startTransaction();

      // Trava o PTS e refaz a checagem: um encerramento simultâneo não passa.
      const locked = await queryRunner.manager
        .createQueryBuilder(PtsEntity, 'pts')
        .setLock('pessimistic_write')
        .where('pts.id = :id', { id: input.ptsId })
        .getOne();

      if (!locked) {
        throw ptsNotFound();
      }

      if (
        locked.status !== PtsStateEnum.PLANNING &&
        locked.status !== PtsStateEnum.RUNNING
      ) {
        throw ptsNotActive();
      }

      await queryRunner.manager.update(PtsEntity, input.ptsId, input.sheet);

      await this.timelineRecorder.record(
        {
          type: TimelineRecordType.PtsUpdated,
          description: input.description,
          targetId: input.ptsId,
          targetType: TimelineRecordTarget.Pts,
          ptsId: input.ptsId,
          authorProfessionalId: input.authorProfessionalId,
          executedByAccountId: input.executedByAccountId,
        },
        queryRunner.manager,
      );

      await queryRunner.commitTransaction();

      return { id: input.ptsId, ...input.sheet };
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
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

  async softDeleteProposal(id: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();

    try {
      await queryRunner.startTransaction();

      // Trava a proposta e refaz as checagens: uma aprovação ou outra
      // exclusão simultânea não passam despercebidas. O query builder já
      // ignora propostas com deletedAt preenchido.
      const locked = await queryRunner.manager
        .createQueryBuilder(PtsEntity, 'pts')
        .setLock('pessimistic_write')
        .where('pts.id = :id', { id })
        .getOne();

      if (!locked) {
        throw ptsProposalNotFound();
      }

      if (locked.status !== PtsStateEnum.DRAFT) {
        throw ptsProposalNotDraftForDelete();
      }

      // Só deletedAt muda: a linha e a equipe continuam no banco.
      await queryRunner.manager.softDelete(PtsEntity, id);

      await queryRunner.commitTransaction();
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAccountDisplayName(accountId: string): Promise<string | null> {
    const account = await this.dataSource.getRepository(Account).findOne({
      where: { id: accountId },
      select: { id: true, name: true, socialName: true },
    });

    return account ? account.socialName?.trim() || account.name : null;
  }

  async findPtsTeam(id: string): Promise<PtsTeamResponseDto | null> {
    const pts = await this.ptsRepository.findOne({
      where: { id },
      relations: {
        responsible: { account: true },
        team: { account: true },
      },
    });

    return pts ? this.toTeamResponse(pts) : null;
  }

  async removeTeamMember(
    input: RemoveTeamMemberInput,
  ): Promise<PtsTeamResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();

    try {
      await queryRunner.startTransaction();

      // Trava o PTS e refaz as checagens: uma transferência de
      // responsabilidade ou um encerramento simultâneo não passam despercebidos.
      const locked = await queryRunner.manager
        .createQueryBuilder(PtsEntity, 'pts')
        .setLock('pessimistic_write')
        .where('pts.id = :id', { id: input.ptsId })
        .getOne();

      if (!locked) {
        throw ptsNotFound();
      }

      if (
        input.authorProfessionalId !== null &&
        locked.responsibleProfessionalId !== input.authorProfessionalId
      ) {
        throw teamEditForbidden();
      }

      if (
        locked.status !== PtsStateEnum.PLANNING &&
        locked.status !== PtsStateEnum.RUNNING
      ) {
        throw ptsNotActive();
      }

      if (locked.responsibleProfessionalId === input.professionalId) {
        throw cannotRemoveResponsible();
      }

      const removed = await queryRunner.manager
        .createQueryBuilder()
        .delete()
        .from('professional_participating_on_therapeutic_journey')
        .where('therapeutic_journey_id = :ptsId', { ptsId: input.ptsId })
        .andWhere('professional_id = :professionalId', {
          professionalId: input.professionalId,
        })
        .execute();

      if (!removed.affected) {
        throw teamMemberNotFound();
      }

      // Só o vínculo sai: registros feitos pelo profissional mantêm a autoria.
      await this.timelineRecorder.record(
        {
          type: TimelineRecordType.MemberRemoved,
          description: input.description,
          targetId: input.professionalId,
          targetType: TimelineRecordTarget.TeamMember,
          ptsId: input.ptsId,
          authorProfessionalId: input.authorProfessionalId,
          executedByAccountId: input.executedByAccountId,
        },
        queryRunner.manager,
      );

      const pts = await queryRunner.manager.findOne(PtsEntity, {
        where: { id: input.ptsId },
        relations: {
          responsible: { account: true },
          team: { account: true },
        },
      });

      if (!pts) {
        throw new Error('Erro ao recuperar o PTS atualizado.');
      }

      await queryRunner.commitTransaction();

      return this.toTeamResponse(pts);
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private toTeamResponse(pts: PtsEntity): PtsTeamResponseDto {
    return {
      id: pts.id,
      status: pts.status,
      responsible: this.mapProfessional(pts.responsible),
      team: (pts.team ?? []).map((professional) =>
        this.mapProfessional(professional),
      ),
    };
  }

  async findPtsTeamTarget(id: string): Promise<PtsTeamTarget | null> {
    const pts = await this.ptsRepository.findOne({
      where: { id },
      relations: {
        responsible: { account: true },
        team: { account: true },
      },
    });

    if (!pts) {
      return null;
    }

    return {
      id: pts.id,
      status: pts.status as PtsStateEnum,
      responsibleProfessionalId: pts.responsibleProfessionalId,
      responsibleAccountId: pts.responsible?.account?.id ?? '',
      responsibleName: pts.responsible?.account?.name ?? '',
      teamMembers: (pts.team ?? []).map((member) => ({
        professionalId: member.id,
        accountId: member.account?.id ?? '',
      })),
    };
  }

  async findProfessionalsWithAccountByIds(
    ids: string[],
  ): Promise<ProfessionalAccountRecord[]> {
    if (ids.length === 0) {
      return [];
    }

    const found = await this.professionalRepository.find({
      where: { id: In(ids) },
      relations: { account: true },
    });

    return found.map((professional) => ({
      id: professional.id,
      accountId: professional.account?.id ?? '',
      name: professional.account?.name ?? '',
    }));
  }

  async addTeamMembers(
    input: AddTeamMembersInput,
  ): Promise<PtsTeamResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();

    try {
      await queryRunner.startTransaction();

      // Trava o PTS e refaz as checagens: uma transferência de
      // responsabilidade ou um encerramento simultâneo não passam despercebidos.
      const locked = await queryRunner.manager
        .createQueryBuilder(PtsEntity, 'pts')
        .setLock('pessimistic_write')
        .where('pts.id = :id', { id: input.ptsId })
        .getOne();

      if (!locked) {
        throw ptsNotFound();
      }

      if (
        input.authorProfessionalId !== null &&
        locked.responsibleProfessionalId !== input.authorProfessionalId
      ) {
        throw teamEditForbidden();
      }

      if (
        locked.status !== PtsStateEnum.PLANNING &&
        locked.status !== PtsStateEnum.RUNNING
      ) {
        throw ptsNotActive();
      }

      for (const member of input.members) {
        await queryRunner.query(
          `INSERT INTO professional_participating_on_therapeutic_journey
            (professional_id, therapeutic_journey_id)
           VALUES ($1, $2)`,
          [member.professionalId, input.ptsId],
        );

        await this.timelineRecorder.record(
          {
            type: TimelineRecordType.MemberAdded,
            description: member.description,
            targetId: member.professionalId,
            targetType: TimelineRecordTarget.TeamMember,
            ptsId: input.ptsId,
            authorProfessionalId: input.authorProfessionalId,
            executedByAccountId: input.executedByAccountId,
          },
          queryRunner.manager,
        );
      }

      const pts = await queryRunner.manager.findOne(PtsEntity, {
        where: { id: input.ptsId },
        relations: {
          responsible: { account: true },
          team: { account: true },
        },
      });

      if (!pts) {
        throw ptsNotFound();
      }

      await queryRunner.commitTransaction();

      return this.toTeamResponse(pts);
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async transferResponsibility(
    input: TransferResponsibilityInput,
  ): Promise<PtsTeamResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();

    try {
      await queryRunner.startTransaction();

      const locked = await queryRunner.manager
        .createQueryBuilder(PtsEntity, 'pts')
        .setLock('pessimistic_write')
        .where('pts.id = :id', { id: input.ptsId })
        .getOne();

      if (!locked) {
        throw ptsNotFound();
      }

      if (
        input.authorProfessionalId !== null &&
        locked.responsibleProfessionalId !== input.authorProfessionalId
      ) {
        throw teamEditForbidden();
      }

      if (
        locked.status !== PtsStateEnum.PLANNING &&
        locked.status !== PtsStateEnum.RUNNING
      ) {
        throw ptsNotActive();
      }

      const newResponsible = await queryRunner.manager.findOne(Professional, {
        where: { id: input.newResponsibleId },
        relations: { account: true },
      });

      if (!newResponsible) {
        throw newResponsibleNotFound();
      }

      if (
        !newResponsible.account ||
        newResponsible.id === locked.responsibleProfessionalId
      ) {
        throw newResponsibleInvalid();
      }

      const duplicateRows = (await queryRunner.query(
        `SELECT p.id
         FROM professional_participating_on_therapeutic_journey participation
         INNER JOIN professional p ON p.id = participation.professional_id
         WHERE participation.therapeutic_journey_id = $1
           AND p.account_id = $2
           AND p.id <> $3`,
        [input.ptsId, newResponsible.account.id, input.newResponsibleId],
      )) as Array<{ id: string }>;

      if (duplicateRows.length > 0) {
        throw teamDuplicateAccount([input.newResponsibleId]);
      }

      const previousResponsibleId = locked.responsibleProfessionalId;

      await queryRunner.manager.update(PtsEntity, input.ptsId, {
        responsibleProfessionalId: input.newResponsibleId,
      });

      await queryRunner.manager
        .createQueryBuilder()
        .delete()
        .from('professional_participating_on_therapeutic_journey')
        .where('therapeutic_journey_id = :ptsId', { ptsId: input.ptsId })
        .andWhere('professional_id IN (:...professionalIds)', {
          professionalIds: [previousResponsibleId, input.newResponsibleId],
        })
        .execute();

      await this.timelineRecorder.record(
        {
          type: TimelineRecordType.ResponsibilityTransferred,
          description: input.description,
          targetId: input.newResponsibleId,
          targetType: TimelineRecordTarget.TeamMember,
          ptsId: input.ptsId,
          authorProfessionalId: input.authorProfessionalId,
          executedByAccountId: input.executedByAccountId,
        },
        queryRunner.manager,
      );

      const pts = await queryRunner.manager.findOne(PtsEntity, {
        where: { id: input.ptsId },
        relations: {
          responsible: { account: true },
          team: { account: true },
        },
      });

      if (!pts) {
        throw ptsNotFound();
      }

      await queryRunner.commitTransaction();

      return this.toTeamResponse(pts);
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async closePts(input: ClosePtsInput): Promise<ClosePtsResponseDto> {
    const { ptsId, outcome, closingDate, closingReason } = input;
    const concluded = outcome === 'concluded';
    const author = {
      ptsId,
      authorProfessionalId: input.authorProfessionalId,
      executedByAccountId: input.executedByAccountId,
    };
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();

    try {
      await queryRunner.startTransaction();

      const { manager } = queryRunner;
      // Trava o PTS e refaz as checagens: outro encerramento ou uma
      // transferência simultânea não passam despercebidos.
      const locked = await manager
        .createQueryBuilder(PtsEntity, 'pts')
        .setLock('pessimistic_write')
        .where('pts.id = :id', { id: ptsId })
        .getOne();

      if (!locked) {
        throw ptsNotFound();
      }

      if (
        input.authorProfessionalId !== null &&
        locked.responsibleProfessionalId !== input.authorProfessionalId
      ) {
        throw ptsCloseForbidden();
      }

      if (
        locked.status !== PtsStateEnum.PLANNING &&
        locked.status !== PtsStateEnum.RUNNING
      ) {
        throw ptsCloseNotActive();
      }

      const now = new Date();

      await manager.update(PtsEntity, ptsId, {
        status: concluded ? PtsStateEnum.CONCLUDED : PtsStateEnum.CANCELLED,
        ...(concluded ? { concludedAt: now } : { cancelledAt: now }),
        closingDate,
        closingReason,
        closedByAccountId: input.executedByAccountId,
      });
      await this.timelineRecorder.record(
        {
          ...author,
          type: concluded
            ? TimelineRecordType.PtsConcluded
            : TimelineRecordType.PtsCancelled,
          description: input.description,
          targetId: ptsId,
          targetType: TimelineRecordTarget.Pts,
        },
        manager,
      );

      const activities = await manager.find(ActivityEntity, {
        where: {
          ptsId,
          status: In([ActivityState.Running, ActivityState.Suspended]),
        },
        select: { id: true, title: true },
        order: { createdAt: 'ASC', id: 'ASC' },
      });

      if (activities.length > 0) {
        await manager.update(
          ActivityEntity,
          { id: In(activities.map(({ id }) => id)) },
          {
            status: concluded
              ? ActivityState.Concluded
              : ActivityState.Archived,
            statusChangedByAccountId: input.executedByAccountId,
            updatedAt: now,
            ...(concluded ? { concludedAt: now } : { archivedAt: now }),
          },
        );
      }

      for (const activity of activities) {
        await this.timelineRecorder.record(
          {
            ...author,
            type: concluded
              ? TimelineRecordType.ActivityConcluded
              : TimelineRecordType.ActivityArchived,
            description: input.activityDescription(activity.title),
            targetId: activity.id,
            targetType: TimelineRecordTarget.Activity,
          },
          manager,
        );
      }

      await queryRunner.commitTransaction();

      return { id: ptsId, status: outcome, closingDate, closingReason };
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async startPts(input: StartPtsInput): Promise<PtsStartResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();

    try {
      await queryRunner.startTransaction();

      // Trava o PTS e refaz as checagens: outro início, um encerramento ou uma
      // transferência simultânea não passam despercebidos.
      const locked = await queryRunner.manager
        .createQueryBuilder(PtsEntity, 'pts')
        .setLock('pessimistic_write')
        .where('pts.id = :id', { id: input.ptsId })
        .getOne();

      if (!locked) {
        throw ptsNotFound();
      }

      if (
        input.authorProfessionalId !== null &&
        locked.responsibleProfessionalId !== input.authorProfessionalId
      ) {
        throw ptsStartForbidden();
      }

      if (locked.status !== PtsStateEnum.PLANNING) {
        throw ptsNotPlanning();
      }

      const beganAt = new Date();

      await queryRunner.manager.update(PtsEntity, input.ptsId, {
        status: PtsStateEnum.RUNNING,
        beganAt,
      });

      await this.timelineRecorder.record(
        {
          type: TimelineRecordType.PtsStarted,
          description: input.description,
          targetId: input.ptsId,
          targetType: TimelineRecordTarget.Pts,
          ptsId: input.ptsId,
          authorProfessionalId: input.authorProfessionalId,
          executedByAccountId: input.executedByAccountId,
        },
        queryRunner.manager,
      );

      await queryRunner.commitTransaction();

      return {
        id: input.ptsId,
        status: PtsStateEnum.RUNNING,
        beganAt: beganAt.toISOString(),
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

  private toListItem(
    pts: PtsEntity,
    versions: Map<string, number>,
  ): PtsListItemResponseDto {
    const account = pts.patient.account;

    return {
      id: pts.id,
      status: pts.status,
      version: versions.get(pts.id) ?? 1,
      createdAt: pts.createdAt.toISOString(),
      beganAt: pts.beganAt?.toISOString() ?? null,
      closedAt:
        pts.concludedAt?.toISOString() ??
        pts.cancelledAt?.toISOString() ??
        null,
      patient: {
        id: pts.patient.accountId,
        name: account?.socialName?.trim() || account?.name || '',
      },
      responsible: this.mapProfessional(pts.responsible),
      team: (pts.team ?? []).map((professional) =>
        this.mapProfessional(professional),
      ),
    };
  }

  private toActiveResponse(pts: PtsEntity): ActivePtsResponseDto {
    return {
      id: pts.id,
      status: pts.status as PtsStateEnum.PLANNING | PtsStateEnum.RUNNING,
      socialSituation: pts.socialSituation,
      caseStudyDate: pts.caseStudyDate,
      diagnosisSummary: pts.diagnosisSummary,
      cid: pts.cid,
      supportLevel: pts.supportLevel,
      strengths: pts.strengths,
      priorityNeeds: pts.priorityNeeds,
      vulnerabilities: pts.vulnerabilities,
      comorbidities: pts.comorbidities,
      sensoryProfile: pts.sensoryProfile,
      communicationMethod: pts.communicationMethod,
      nextReviewAt: pts.nextReviewAt,
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

  private toDetailResponse(pts: PtsEntity): PtsDetailResponseDto {
    return {
      ...this.toActiveResponse(pts),
      status: pts.status,
      rejectedAt: pts.rejectedAt?.toISOString() ?? null,
      concludedAt: pts.concludedAt?.toISOString() ?? null,
      cancelledAt: pts.cancelledAt?.toISOString() ?? null,
      closingDate: pts.closingDate ?? null,
      closingReason: pts.closingReason ?? null,
    };
  }

  private toHistoryItem(
    pts: PtsEntity,
    versions: Map<string, number>,
  ): PtsHistoryItemDto {
    const responsible = this.mapProfessional(pts.responsible);

    return {
      id: pts.id,
      version: versions.get(pts.id) ?? 1,
      status: pts.status,
      responsible: {
        id: responsible.id,
        name: responsible.name,
        specialism: responsible.specialism.name,
      },
      team: (pts.team ?? []).map((member) => ({
        id: member.id,
        name: member.account?.name ?? '',
      })),
      createdAt: pts.createdAt.toISOString(),
      acceptedAt: pts.acceptedAt?.toISOString() ?? null,
      beganAt: pts.beganAt?.toISOString() ?? null,
      closedAt:
        pts.concludedAt?.toISOString() ??
        pts.cancelledAt?.toISOString() ??
        pts.rejectedAt?.toISOString() ??
        null,
      // O resultado das metas é dado na reavaliação (RFEVA005).
      goalsResult: null,
    };
  }

  private mapProfessional(professional: Professional) {
    return {
      id: professional.id,
      name: professional.account?.name ?? '',
      specialism: {
        id: String(professional.specialism),
        name:
          SPECIALISM_NAMES[professional.specialism] ??
          String(professional.specialism),
      },
      registration: toProfessionalRegistration(
        professional.specialism,
        professional.councilNumber,
        professional.councilState,
      ),
    };
  }
}
