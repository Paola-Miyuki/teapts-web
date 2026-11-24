import type { EntityManager } from 'typeorm';

import type { PtsStateEnum } from '../../database/enums/pts-state.enum';
import type { TimelineRecordTarget } from '../enums/timeline-record-target.enum';
import type { TimelineRecordType } from '../enums/timeline-record-type.enum';

/** Evento a gravar na timeline. */
export interface NewTimelineRecord {
  ptsId: string;
  type: TimelineRecordType;
  description: string;
  targetId: string;
  targetType: TimelineRecordTarget;
  /** Profissional atribuído (RN029); nulo quando o admin age sem atribuir. */
  authorProfessionalId: string | null;
  /** Conta que executou a ação (RN029). */
  executedByAccountId: string;
}

/** O que a consulta precisa do PTS para decidir o acesso. */
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
  /** AAAA-MM-DD, inclusive. */
  from?: string;
  /** AAAA-MM-DD, inclusive. */
  to?: string;
  /** Ordem pela data do evento; padrão `desc`. */
  order?: 'asc' | 'desc';
  page: number;
  limit: number;
}

export interface TimelinePerson {
  id: string;
  name: string;
}

/** Evento lido do banco, antes do recorte por papel. */
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

/** Contrato de persistência da timeline. */
export abstract class TimelineRepository {
  /**
   * Grava um evento. Com `manager`, grava na transação de quem chamou, para
   * o evento e a operação serem confirmados ou desfeitos juntos.
   */
  abstract insert(
    record: NewTimelineRecord,
    manager?: EntityManager,
  ): Promise<void>;

  /** PTS não excluído, com o responsável e a equipe; nulo se não existir. */
  abstract findPtsAccess(ptsId: string): Promise<TimelinePtsAccess | null>;

  /** Eventos do PTS por data (padrão: do mais recente ao mais antigo), paginados. */
  abstract findByPts(input: FindTimelineInput): Promise<FindTimelineResult>;
}
