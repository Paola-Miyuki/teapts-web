import { Injectable } from '@nestjs/common';

import type { AccountContext } from '../../accounts/services/accounts.service';
import { isAdmin } from '../../auth/account-context';
import { toPagination } from '../../common/pagination/pagination';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import type { GetTimelineQueryDto } from '../dto/get-timeline-query.dto';
import type {
  GetTimelineResponseDto,
  TimelineRecordDto,
} from '../dto/timeline-record-response.dto';
import { TimelineRecordTarget } from '../enums/timeline-record-target.enum';
import {
  TimelineRepository,
  type TimelinePtsAccess,
  type TimelineRecordRow,
} from '../repositories/timeline.repository';
import {
  invalidTimelinePeriod,
  ptsNotFound,
  timelineForbidden,
} from '../timeline.errors';

type TimelineViewer = 'team' | 'patient';

@Injectable()
export class TimelineService {
  constructor(private readonly timelineRepository: TimelineRepository) {}

  async findTimeline(
    ptsId: string,
    query: GetTimelineQueryDto,
    account: AccountContext,
  ): Promise<GetTimelineResponseDto> {
    const pts = await this.timelineRepository.findPtsAccess(ptsId);

    if (!pts) {
      throw ptsNotFound();
    }

    const viewer = this.resolveViewer(pts, account);

    if (query.from && query.to && query.from > query.to) {
      throw invalidTimelinePeriod();
    }

    const { rows, total } = await this.timelineRepository.findByPts({
      ptsId,
      q: query.q,
      types: query.type,
      authorId: query.authorId,
      from: query.from,
      to: query.to,
      order: query.order,
      page: query.page,
      limit: query.limit,
    });

    return {
      data: rows.map((row) => this.toResponse(row, viewer)),
      pagination: toPagination(query, total),
    };
  }

  // Admin (RN022), equipe (menos PTS rejeitado, RN016) ou paciente titular.
  private resolveViewer(
    pts: TimelinePtsAccess,
    account: AccountContext,
  ): TimelineViewer {
    if (isAdmin(account)) {
      return 'team';
    }

    const profileIds = account.professionalProfileIds;
    const isProfessionalOnPts =
      pts.status !== PtsStateEnum.REJECTED &&
      (profileIds.includes(pts.responsibleProfessionalId) ||
        pts.teamProfessionalIds.some((id) => profileIds.includes(id)));

    if (isProfessionalOnPts) {
      return 'team';
    }

    if (
      account.patientProfileId !== null &&
      account.patientProfileId === pts.patientId
    ) {
      return 'patient';
    }

    throw timelineForbidden();
  }

  private toResponse(
    row: TimelineRecordRow,
    viewer: TimelineViewer,
  ): TimelineRecordDto {
    // O paciente não recebe o alvo dos eventos de documento (RN028).
    const hideTarget =
      viewer === 'patient' && row.targetType === TimelineRecordTarget.Document;

    return {
      id: row.id,
      type: row.type,
      targetType: row.targetType,
      targetId: hideTarget ? null : row.targetId,
      description: row.description,
      happenedAt: row.happenedAt.toISOString(),
      author: row.author,
      assignedTo: row.assignedTo,
    };
  }
}
