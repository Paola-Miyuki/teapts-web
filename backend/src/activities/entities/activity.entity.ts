import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';

import { Professional } from '../../professionals/entities/professional.entity';
import { Specialism } from '../../professionals/enums/specialism.enum';
import {
  ActivityExecutor,
  ActivityModality,
  ActivityPeriod,
  ActivityState,
  ActivityType,
  VisitPlace,
} from '../enums/activity.enums';
import { ActivityDocumentEntity } from './activity-document.entity';

export interface StoredFrequency {
  quantity: number;
  period: ActivityPeriod;
  duration_minutes: number;
}

// Atividade do PTS (RFACT001). As chaves estrangeiras simples ficam na migration.
@Entity('activity')
@Index('IDX_activity_pts_id', ['ptsId'])
export class ActivityEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_activity' })
  id!: string;

  @Column({ name: 'pts_id', type: 'uuid' })
  ptsId!: string;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'enum', enum: ActivityType, enumName: 'activity_type_e' })
  type!: ActivityType;

  @Column({ type: 'enum', enum: Specialism, enumName: 'specialism_e' })
  specialism!: Specialism;

  @Column({ type: 'jsonb' })
  frequency!: StoredFrequency;

  @Column({ type: 'enum', enum: ActivityModality, enumName: 'modality_e' })
  modality!: ActivityModality;

  @Column({
    name: 'visit_place',
    type: 'enum',
    enum: VisitPlace,
    enumName: 'visit_place_e',
    nullable: true,
  })
  visitPlace!: VisitPlace | null;

  @Column({ name: 'planned_start_date', type: 'date', nullable: true })
  plannedStartDate!: string | null;

  @Column({ name: 'planned_end_date', type: 'date', nullable: true })
  plannedEndDate!: string | null;

  @Column({
    type: 'enum',
    enum: ActivityExecutor,
    enumName: 'executor_e',
    default: ActivityExecutor.Team,
  })
  executor!: ActivityExecutor;

  // Profissionais executores (co-terapia); vazio, vale o autor.
  @ManyToMany(() => Professional)
  @JoinTable({
    name: 'activity_executor',
    joinColumn: { name: 'activity_id' },
    inverseJoinColumn: { name: 'professional_id' },
  })
  executors?: Relation<Professional[]>;

  @OneToMany(() => ActivityDocumentEntity, (link) => link.activity)
  documents?: Relation<ActivityDocumentEntity[]>;

  @Column({ name: 'goal_id', type: 'uuid', nullable: true })
  goalId!: string | null;

  @Column({
    type: 'enum',
    enum: ActivityState,
    enumName: 'activity_state_e',
    default: ActivityState.Suggested,
  })
  status!: ActivityState;

  @Column({ name: 'status_reason', type: 'text', nullable: true })
  statusReason!: string | null;

  @Column({
    name: 'status_changed_by_account_id',
    type: 'uuid',
    nullable: true,
  })
  statusChangedByAccountId!: string | null;

  // Profissional autor (RN029); nulo quando o admin cria sem atribuir.
  @Column({ name: 'author_professional_id', type: 'uuid', nullable: true })
  authorProfessionalId!: string | null;

  @Column({ name: 'registered_by_account_id', type: 'uuid' })
  registeredByAccountId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', precision: 3 })
  createdAt!: Date;

  @Column({
    name: 'updated_at',
    type: 'timestamp',
    precision: 3,
    nullable: true,
  })
  updatedAt!: Date | null;

  @Column({
    name: 'approved_at',
    type: 'timestamp',
    precision: 3,
    nullable: true,
  })
  approvedAt!: Date | null;

  @Column({
    name: 'rejected_at',
    type: 'timestamp',
    precision: 3,
    nullable: true,
  })
  rejectedAt!: Date | null;

  @Column({
    name: 'suspended_at',
    type: 'timestamp',
    precision: 3,
    nullable: true,
  })
  suspendedAt!: Date | null;

  @Column({
    name: 'concluded_at',
    type: 'timestamp',
    precision: 3,
    nullable: true,
  })
  concludedAt!: Date | null;

  @Column({
    name: 'archived_at',
    type: 'timestamp',
    precision: 3,
    nullable: true,
  })
  archivedAt!: Date | null;
}
