import type { EntityManager } from 'typeorm';

import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import { TimelineRecordTarget } from '../enums/timeline-record-target.enum';
import { TimelineRecordType } from '../enums/timeline-record-type.enum';
import {
  TimelineRepository,
  type FindTimelineInput,
  type FindTimelineResult,
  type NewTimelineRecord,
  type TimelinePtsAccess,
  type TimelineRecordRow,
} from '../repositories/timeline.repository';

/** Evento guardado em memória, com o profissional atribuído e o perfil de quem executou. */
export interface StoredTimelineRecord extends TimelineRecordRow {
  ptsId: string;
  authorProfessionalId: string | null;
  /** Perfil profissional da conta que executou; nulo para o admin. */
  executorProfessionalId: string | null;
}

/** Dublê em memória do TimelineRepository, com os mesmos filtros do banco. */
export class InMemoryTimelineRepository extends TimelineRepository {
  pts: TimelinePtsAccess[] = [];
  records: StoredTimelineRecord[] = [];
  inserted: { record: NewTimelineRecord; manager?: EntityManager }[] = [];
  lastFindInput: FindTimelineInput | null = null;

  async insert(
    record: NewTimelineRecord,
    manager?: EntityManager,
  ): Promise<void> {
    this.inserted.push({ record: { ...record }, manager });
  }

  async findPtsAccess(ptsId: string): Promise<TimelinePtsAccess | null> {
    return this.pts.find((pts) => pts.id === ptsId) ?? null;
  }

  async findByPts(input: FindTimelineInput): Promise<FindTimelineResult> {
    this.lastFindInput = input;
    const term = input.q?.toLowerCase();

    const filtered = this.records
      .filter((record) => record.ptsId === input.ptsId)
      .filter(
        (record) =>
          !term ||
          record.description.toLowerCase().includes(term) ||
          record.author.name.toLowerCase().includes(term) ||
          (record.assignedTo?.name.toLowerCase().includes(term) ?? false),
      )
      .filter(
        (record) =>
          !input.types?.length || input.types.includes(record.targetType),
      )
      .filter(
        (record) =>
          !input.authorId ||
          record.author.id === input.authorId ||
          record.executorProfessionalId === input.authorId,
      )
      .filter(
        (record) =>
          !input.from ||
          record.happenedAt.toISOString().slice(0, 10) >= input.from,
      )
      .filter(
        (record) =>
          !input.to || record.happenedAt.toISOString().slice(0, 10) <= input.to,
      )
      .sort(
        (a, b) =>
          (b.happenedAt.getTime() - a.happenedAt.getTime() ||
            b.id.localeCompare(a.id)) * (input.order === 'asc' ? -1 : 1),
      );

    const start = (input.page - 1) * input.limit;

    return {
      rows: filtered.slice(start, start + input.limit).map((record) => ({
        id: record.id,
        type: record.type,
        targetType: record.targetType,
        targetId: record.targetId,
        description: record.description,
        happenedAt: record.happenedAt,
        author: record.author,
        assignedTo: record.assignedTo,
      })),
      total: filtered.length,
    };
  }
}

export const PTS_ID = 'pts-100';
export const OTHER_PTS_ID = 'pts-200';
export const PATIENT_ID = 'acc-patient-25';
export const RESPONSIBLE_ID = 'prof-10';
export const MEMBER_ID = 'prof-11';
export const ADMIN_ACCOUNT_ID = 'acc-admin';

/** Evento com valores padrão, para os testes só mudarem o que importa. */
export function timelineRecord(
  overrides: Partial<StoredTimelineRecord> & { id: string },
): StoredTimelineRecord {
  return {
    ptsId: PTS_ID,
    type: TimelineRecordType.ActivityApproved,
    targetType: TimelineRecordTarget.Activity,
    targetId: `target-${overrides.id}`,
    description: 'Kaio aprovou a atividade Integração sensorial',
    happenedAt: new Date('2026-11-12T14:45:00.000Z'),
    author: { id: 'acc-1', name: 'Kaio Segunda Conta' },
    assignedTo: null,
    authorProfessionalId: RESPONSIBLE_ID,
    executorProfessionalId: RESPONSIBLE_ID,
    ...overrides,
  };
}

/** PTS em andamento com um responsável, um membro e eventos de todos os tipos. */
export function seededTimelineRepo(): InMemoryTimelineRepository {
  const repo = new InMemoryTimelineRepository();

  repo.pts.push(
    {
      id: PTS_ID,
      status: PtsStateEnum.RUNNING,
      patientId: PATIENT_ID,
      responsibleProfessionalId: RESPONSIBLE_ID,
      teamProfessionalIds: [MEMBER_ID],
    },
    {
      id: OTHER_PTS_ID,
      status: PtsStateEnum.RUNNING,
      patientId: 'acc-patient-99',
      responsibleProfessionalId: 'prof-90',
      teamProfessionalIds: [],
    },
  );

  repo.records.push(
    timelineRecord({
      id: 'rec-1',
      type: TimelineRecordType.PtsCreated,
      targetType: TimelineRecordTarget.Pts,
      targetId: PTS_ID,
      description:
        'Admin criou o PTS e atribuiu Kaio Segunda Conta como responsável',
      happenedAt: new Date('2026-11-01T09:00:00.000Z'),
      author: { id: ADMIN_ACCOUNT_ID, name: 'Admin' },
      assignedTo: { id: RESPONSIBLE_ID, name: 'Kaio Segunda Conta' },
      authorProfessionalId: RESPONSIBLE_ID,
      executorProfessionalId: null,
    }),
    timelineRecord({
      id: 'rec-2',
      type: TimelineRecordType.MemberRemoved,
      targetType: TimelineRecordTarget.TeamMember,
      targetId: 'prof-12',
      description: 'Kaio Segunda Conta removeu Ana Souza da equipe',
      happenedAt: new Date('2026-11-05T10:00:00.000Z'),
    }),
    timelineRecord({
      id: 'rec-3',
      happenedAt: new Date('2026-11-12T14:45:00.000Z'),
    }),
    timelineRecord({
      id: 'rec-4',
      type: TimelineRecordType.DocumentUploaded,
      targetType: TimelineRecordTarget.Document,
      targetId: 'doc-1',
      description: 'João Lima enviou o documento Laudo neurológico',
      happenedAt: new Date('2026-11-20T08:30:00.000Z'),
      author: { id: 'acc-2', name: 'João Lima' },
      authorProfessionalId: MEMBER_ID,
      executorProfessionalId: MEMBER_ID,
    }),
    timelineRecord({
      id: 'rec-other',
      ptsId: OTHER_PTS_ID,
      description: 'Evento de outro PTS',
      happenedAt: new Date('2026-11-21T08:30:00.000Z'),
    }),
  );

  return repo;
}
