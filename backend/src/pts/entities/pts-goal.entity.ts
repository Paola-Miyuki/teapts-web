import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';

import { Account } from '../../accounts/entities/account.entity';
import { Professional } from '../../professionals/entities/professional.entity';
import {
  GoalArea,
  GoalOrigin,
  GoalStatus,
  GoalTerm,
} from '../enums/goal.enums';
import { PtsEntity } from './pts.entity';

/** Meta terapêutica do PTS (RFPTS012). */
@Entity('pts_goal')
@Index('IDX_pts_goal_pts_id', ['ptsId'])
export class PtsGoalEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_pts_goal' })
  id: string;

  @Column({ name: 'pts_id', type: 'uuid' })
  ptsId: string;

  @ManyToOne(() => PtsEntity)
  @JoinColumn({ name: 'pts_id', foreignKeyConstraintName: 'FK_pts_goal_pts' })
  pts?: Relation<PtsEntity>;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: GoalTerm,
    enumName: 'goal_term_e',
    nullable: true,
  })
  term: GoalTerm | null;

  @Column({ type: 'enum', enum: GoalArea, enumName: 'goal_area_e' })
  area: GoalArea;

  @Column({ name: 'measure_criterion', type: 'text' })
  measureCriterion: string;

  @Column({ name: 'target_date', type: 'date', nullable: true })
  targetDate: string | null;

  @Column({
    type: 'enum',
    enum: GoalStatus,
    enumName: 'goal_status_e',
    default: GoalStatus.InProgress,
  })
  status: GoalStatus;

  @Column({ name: 'result_note', type: 'text', nullable: true })
  resultNote: string | null;

  @Column({
    name: 'result_recorded_at',
    type: 'timestamp',
    precision: 3,
    nullable: true,
  })
  resultRecordedAt: Date | null;

  @Column({
    name: 'result_recorded_by_account_id',
    type: 'uuid',
    nullable: true,
  })
  resultRecordedByAccountId: string | null;

  @ManyToOne(() => Account, { nullable: true })
  @JoinColumn({
    name: 'result_recorded_by_account_id',
    foreignKeyConstraintName: 'FK_pts_goal_result_recorded_by',
  })
  resultRecordedBy?: Relation<Account> | null;

  @Column({
    type: 'enum',
    enum: GoalOrigin,
    enumName: 'goal_origin_e',
    default: GoalOrigin.New,
  })
  origin: GoalOrigin;

  @Column({ name: 'previous_goal_id', type: 'uuid', nullable: true })
  previousGoalId: string | null;

  @ManyToOne(() => PtsGoalEntity, { nullable: true })
  @JoinColumn({
    name: 'previous_goal_id',
    foreignKeyConstraintName: 'FK_pts_goal_previous_goal',
  })
  previousGoal?: Relation<PtsGoalEntity> | null;

  // Profissional autor (RN029); nulo quando o admin cadastra sem atribuir.
  @Column({ name: 'author_professional_id', type: 'uuid', nullable: true })
  authorProfessionalId: string | null;

  @ManyToOne(() => Professional, { nullable: true })
  @JoinColumn({
    name: 'author_professional_id',
    foreignKeyConstraintName: 'FK_pts_goal_author_professional',
  })
  authorProfessional?: Relation<Professional> | null;

  @Column({ name: 'registered_by_account_id', type: 'uuid' })
  registeredByAccountId: string;

  @ManyToOne(() => Account)
  @JoinColumn({
    name: 'registered_by_account_id',
    foreignKeyConstraintName: 'FK_pts_goal_registered_by',
  })
  registeredBy?: Relation<Account>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', precision: 3 })
  createdAt: Date;

  @Column({
    name: 'updated_at',
    type: 'timestamp',
    precision: 3,
    nullable: true,
  })
  updatedAt: Date | null;

  // Exclusão lógica (RN021).
  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'timestamp',
    precision: 3,
    nullable: true,
  })
  deletedAt: Date | null;
}
