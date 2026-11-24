import type { EntityManager } from 'typeorm';

import type { PtsStateEnum } from '../../database/enums/pts-state.enum';
import type { TimelineRecordTarget } from '../enums/timeline-record-target.enum';
import type { TimelineRecordType } from '../enums/timeline-record-type.enum';

export interface NewTimelineRecord {
  ptsId: string;
  type: TimelineRecordType;
  description: string;
  targetId: string;
  targetType: TimelineRecordTarget;
  authorProfessionalId: string | null;
  executedByAccountId: string;
}

export interface TimelinePtsAccess {
  id: string;
  status: PtsStateEnum;
  patientId: string;
  responsibleProfessionalId: string;
  teamProfessionalIds: string[];
}

export interface FindTimelineInput {
  ptsId: string;
  q?: string;
  types?: TimelineRecordTarget[];
  authorId?: string;
  from?: string;
  to?: string;
  order?: 'asc' | 'desc';
  page: number;
  limit: number;
}

export interface TimelinePerson {
  id: string;
  name: string;
}

export interface TimelineRecordRow {
  id: string;
  type: TimelineRecordType;
  targetType: TimelineRecordTarget;
  targetId: string;
  description: string;
  happenedAt: Date;
  author: TimelinePerson;
  assignedTo: TimelinePerson | null;
}

export interface FindTimelineResult {
  rows: TimelineRecordRow[];
  total: number;
}

export abstract class TimelineRepository {
  abstract insert(
    record: NewTimelineRecord,
    manager?: EntityManager,
  ): Promise<void>;

  abstract findPtsAccess(ptsId: string): Promise<TimelinePtsAccess | null>;

  abstract findByPts(input: FindTimelineInput): Promise<FindTimelineResult>;
}
