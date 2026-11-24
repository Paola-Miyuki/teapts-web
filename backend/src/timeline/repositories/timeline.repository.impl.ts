import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, type EntityManager, Repository } from 'typeorm';

import type { Account } from '../../accounts/entities/account.entity';
import { escapeLike } from '../../common/search/escape-like';
import { PtsEntity } from '../../pts/entities/pts.entity';
import { TimelineRecordEntity } from '../entities/timeline-record.entity';
import {
  TimelineRepository,
  type FindTimelineInput,
  type FindTimelineResult,
  type NewTimelineRecord,
  type TimelinePerson,
  type TimelinePtsAccess,
  type TimelineRecordRow,
} from './timeline.repository';

function displayName(account: Pick<Account, 'name' | 'socialName'>): string {
  return account.socialName?.trim() || account.name;
}

@Injectable()
export class TimelineRepositoryImpl extends TimelineRepository {
  constructor(
    @InjectRepository(TimelineRecordEntity)
    private readonly timelineRepository: Repository<TimelineRecordEntity>,
    @InjectRepository(PtsEntity)
    private readonly ptsRepository: Repository<PtsEntity>,
  ) {
    super();
  }

  async insert(
    record: NewTimelineRecord,
    manager?: EntityManager,
  ): Promise<void> {
    await (manager ?? this.timelineRepository.manager).insert(
      TimelineRecordEntity,
      {
        type: record.type,
        description: record.description,
        targetId: record.targetId,
        targetType: record.targetType,
        ptsId: record.ptsId,
        authorProfessionalId: record.authorProfessionalId,
        executedByAccountId: record.executedByAccountId,
      },
    );
  }

  async findPtsAccess(ptsId: string): Promise<TimelinePtsAccess | null> {
    // O TypeORM ignora a proposta excluída (deleted_at).
    const pts = await this.ptsRepository.findOne({
      where: { id: ptsId },
      relations: { team: true },
    });

    if (!pts) {
      return null;
    }

    return {
      id: pts.id,
      status: pts.status,
      patientId: pts.patientId,
      responsibleProfessionalId: pts.responsibleProfessionalId,
      teamProfessionalIds: (pts.team ?? []).map((member) => member.id),
    };
  }

  async findByPts(input: FindTimelineInput): Promise<FindTimelineResult> {
    const query = this.timelineRepository
      .createQueryBuilder('record')
      .innerJoinAndSelect('record.executedBy', 'executedBy')
      .leftJoinAndSelect('record.authorProfessional', 'authorProfessional')
      .leftJoinAndSelect('authorProfessional.account', 'authorAccount')
      .where('record.ptsId = :ptsId', { ptsId: input.ptsId });

    if (input.q) {
      query.andWhere(
        new Brackets((where) => {
          where
            .where(`record.description ILIKE :term ESCAPE '\\'`)
            .orWhere(`executedBy.name ILIKE :term ESCAPE '\\'`)
            .orWhere(`executedBy.socialName ILIKE :term ESCAPE '\\'`)
            .orWhere(`authorAccount.name ILIKE :term ESCAPE '\\'`)
            .orWhere(`authorAccount.socialName ILIKE :term ESCAPE '\\'`);
        }),
        { term: `%${escapeLike(input.q)}%` },
      );
    }

    if (input.types?.length) {
      query.andWhere('record.targetType IN (:...types)', {
        types: input.types,
      });
    }

    // Autor é quem executou (executed_by_account_id), pela conta ou pelo perfil profissional dela.
    if (input.authorId) {
      query.andWhere(
        new Brackets((where) => {
          where
            .where('record.executedByAccountId = :authorId')
            .orWhere(
              'record.executedByAccountId IN (SELECT author.account_id FROM professional author WHERE author.id = :authorId)',
            );
        }),
        { authorId: input.authorId },
      );
    }

    if (input.from) {
      query.andWhere('record.happenedAt >= CAST(:from AS date)', {
        from: input.from,
      });
    }

    if (input.to) {
      query.andWhere('record.happenedAt < CAST(:to AS date) + 1', {
        to: input.to,
      });
    }

    const direction = input.order === 'asc' ? 'ASC' : 'DESC';
    const [records, total] = await query
      .orderBy('record.happenedAt', direction)
      .addOrderBy('record.id', direction)
      .skip((input.page - 1) * input.limit)
      .take(input.limit)
      .getManyAndCount();

    return { rows: records.map((record) => this.toRow(record)), total };
  }

  private toRow(record: TimelineRecordEntity): TimelineRecordRow {
    const executedBy = record.executedBy;
    const professional = record.authorProfessional ?? null;

    return {
      id: record.id,
      type: record.type,
      targetType: record.targetType,
      targetId: record.targetId,
      description: record.description,
      happenedAt: record.happenedAt,
      author: {
        id: record.executedByAccountId,
        name: executedBy ? displayName(executedBy) : '',
      },
      assignedTo: this.toAssignedTo(record.executedByAccountId, professional),
    };
  }

  // "Atribuído a" só quando outra conta (o admin) agiu em nome do profissional (RN029).
  private toAssignedTo(
    executedByAccountId: string,
    professional: TimelineRecordEntity['authorProfessional'],
  ): TimelinePerson | null {
    if (!professional || professional.accountId === executedByAccountId) {
      return null;
    }

    return {
      id: professional.id,
      name: professional.account ? displayName(professional.account) : '',
    };
  }
}
