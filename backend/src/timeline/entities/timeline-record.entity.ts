import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';

import { Account } from '../../accounts/entities/account.entity';
import { Professional } from '../../professionals/entities/professional.entity';
import { PtsEntity } from '../../pts/entities/pts.entity';
import { TimelineRecordTarget } from '../enums/timeline-record-target.enum';
import { TimelineRecordType } from '../enums/timeline-record-type.enum';

/** Evento do histórico de um PTS (RFTL001). Registros não são editados. */
@Entity('timeline_record')
@Index('IDX_timeline_record_pts_happened_at', ['ptsId', 'happenedAt'])
export class TimelineRecordEntity {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_timeline_record',
  })
  id: string;

  @Column({ name: 'pts_id', type: 'uuid' })
  ptsId: string;

  @ManyToOne(() => PtsEntity)
  @JoinColumn({
    name: 'pts_id',
    foreignKeyConstraintName: 'FK_timeline_record_pts',
  })
  pts?: Relation<PtsEntity>;

  @Column({
    type: 'enum',
    enum: TimelineRecordType,
    enumName: 'timeline_record_type_e',
  })
  type: TimelineRecordType;

  @Column({ type: 'text' })
  description: string;

  @CreateDateColumn({ name: 'happened_at', type: 'timestamp', precision: 3 })
  happenedAt: Date;

  @Column({ name: 'target_id', type: 'uuid' })
  targetId: string;

  @Column({
    name: 'target_type',
    type: 'enum',
    enum: TimelineRecordTarget,
    enumName: 'timeline_record_target_e',
  })
  targetType: TimelineRecordTarget;

  // Profissional atribuído ao evento (RN029); nulo quando o admin age sem
  // atribuir um profissional.
  @Column({ name: 'author_professional_id', type: 'uuid', nullable: true })
  authorProfessionalId: string | null;

  @ManyToOne(() => Professional, { nullable: true })
  @JoinColumn({
    name: 'author_professional_id',
    foreignKeyConstraintName: 'FK_timeline_record_author_professional',
  })
  authorProfessional?: Relation<Professional> | null;

  // Conta que executou a ação (RN029).
  @Column({ name: 'executed_by_account_id', type: 'uuid' })
  executedByAccountId: string;

  @ManyToOne(() => Account)
  @JoinColumn({
    name: 'executed_by_account_id',
    foreignKeyConstraintName: 'FK_timeline_record_executed_by',
  })
  executedBy?: Relation<Account>;
}
