import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  ManyToMany,
  JoinTable,
  JoinColumn,
  CreateDateColumn,
  DeleteDateColumn,
  Unique,
  type Relation,
} from 'typeorm';
import { Patient } from '../../patients/entities/patient.entity';
import { Professional } from '../../professionals/entities/professional.entity';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';

@Entity('projeto_terapeutico_singular')
@Unique('UQ_pts_patient_version', ['patientId', 'version'])
export class PtsEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: PtsStateEnum,
    enumName: 'pts_state_e',
  })
  status: PtsStateEnum;

  @Column('text', { name: 'social_situation' })
  socialSituation: string;

  // Ficha do PTS (RFPTS005, RN030). Datas 'date' voltam como 'yyyy-mm-dd'.
  @Column({ name: 'case_study_date', type: 'date' })
  caseStudyDate: string;

  @Column({ name: 'diagnosis_summary', type: 'text' })
  diagnosisSummary: string;

  @Column({ type: 'text', nullable: true })
  cid: string | null;

  @Column({ name: 'support_level', type: 'smallint', nullable: true })
  supportLevel: number | null;

  @Column({ type: 'text', nullable: true })
  strengths: string | null;

  @Column({ name: 'priority_needs', type: 'text', array: true, default: [] })
  priorityNeeds: string[];

  @Column({ type: 'text', nullable: true })
  vulnerabilities: string | null;

  @Column({ type: 'text', nullable: true })
  comorbidities: string | null;

  @Column({ name: 'sensory_profile', type: 'text', nullable: true })
  sensoryProfile: string | null;

  @Column({ name: 'communication_method', type: 'text', nullable: true })
  communicationMethod: string | null;

  @Column({ name: 'next_review_at', type: 'date' })
  nextReviewAt: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', precision: 3 })
  createdAt: Date;

  // Exclusão lógica (RN021): as consultas do TypeORM ignoram linhas com
  // deleted_at preenchido, a menos que usem withDeleted.
  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'timestamp',
    precision: 3,
    nullable: true,
  })
  deletedAt: Date | null;

  @Column({
    name: 'accepted_at',
    type: 'timestamp',
    precision: 3,
    nullable: true,
  })
  acceptedAt: Date | null;

  @Column({
    name: 'rejected_at',
    type: 'timestamp',
    precision: 3,
    nullable: true,
  })
  rejectedAt: Date | null;

  @Column({ name: 'began_at', type: 'timestamp', precision: 3, nullable: true })
  beganAt: Date | null;

  @Column({
    name: 'concluded_at',
    type: 'timestamp',
    precision: 3,
    nullable: true,
  })
  concludedAt: Date | null;

  @Column({
    name: 'cancelled_at',
    type: 'timestamp',
    precision: 3,
    nullable: true,
  })
  cancelledAt: Date | null;

  // Data informada no modal de encerramento; volta como 'yyyy-mm-dd'.
  @Column({ name: 'closing_date', type: 'date', nullable: true })
  closingDate: string | null;

  @Column({ name: 'closing_reason', type: 'text', nullable: true })
  closingReason: string | null;

  @Column({ name: 'closed_by_account_id', type: 'uuid', nullable: true })
  closedByAccountId: string | null;

  // Versão do paciente (1, 2, 3…); toda criação usa nextPtsVersion.
  @Column({ type: 'integer', default: 1 })
  version: number;

  @Column({ name: 'previous_pts_id', type: 'uuid', nullable: true })
  previousPtsId: string | null;

  @ManyToOne(() => PtsEntity, { nullable: true })
  @JoinColumn({
    name: 'previous_pts_id',
    foreignKeyConstraintName: 'FK_pts_previous',
  })
  previousPts?: Relation<PtsEntity> | null;

  @Column({ name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient, { eager: true })
  @JoinColumn({ name: 'patient_id', referencedColumnName: 'accountId' })
  patient: Patient;

  @Column({ name: 'responsible_professional_id' })
  responsibleProfessionalId: string;

  @ManyToOne(() => Professional, { eager: true })
  @JoinColumn({
    name: 'responsible_professional_id',
    referencedColumnName: 'id',
  })
  responsible: Professional;

  @ManyToMany(() => Professional, { eager: true })
  @JoinTable({
    name: 'professional_participating_on_therapeutic_journey',
    joinColumn: {
      name: 'therapeutic_journey_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'professional_id',
      referencedColumnName: 'id',
    },
  })
  team: Professional[];
}
