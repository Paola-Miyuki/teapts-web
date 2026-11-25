import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import {
  ActivityModality,
  VisitPlace,
} from '../../activities/enums/activity.enums';
import { Attendance } from '../enums/attendance.enum';

// Atendimento (RFACT004): não é editado nem excluído; a correção é um novo
// registro (RN020). As chaves estrangeiras ficam na migration.
@Entity('appointment')
@Index('IDX_appointment_activity_id', ['activityId'])
@Check(
  'CHK_appointment_soap',
  `"attendance" <> 'done' OR ("end_time" IS NOT NULL AND "soap_subjective" IS NOT NULL AND "soap_objective" IS NOT NULL AND "soap_assessment" IS NOT NULL AND "soap_plan" IS NOT NULL)`,
)
export class AppointmentEntity {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_appointment',
  })
  id!: string;

  @Column({ name: 'activity_id', type: 'uuid' })
  activityId!: string;

  // Profissional autor (RN029); nulo quando o admin registra sem atribuir.
  @Column({ name: 'author_professional_id', type: 'uuid', nullable: true })
  authorProfessionalId!: string | null;

  @Column({ name: 'registered_by_account_id', type: 'uuid' })
  registeredByAccountId!: string;

  @Column({ name: 'appointment_date', type: 'date' })
  appointmentDate!: string;

  @Column({ name: 'start_time', type: 'time' })
  startTime!: string;

  @Column({ name: 'end_time', type: 'time', nullable: true })
  endTime!: string | null;

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

  @Column({ type: 'enum', enum: Attendance, enumName: 'attendance_e' })
  attendance!: Attendance;

  @Column({ name: 'soap_subjective', type: 'text', nullable: true })
  soapSubjective!: string | null;

  @Column({ name: 'soap_objective', type: 'text', nullable: true })
  soapObjective!: string | null;

  @Column({ name: 'soap_assessment', type: 'text', nullable: true })
  soapAssessment!: string | null;

  @Column({ name: 'soap_plan', type: 'text', nullable: true })
  soapPlan!: string | null;

  @Column({ name: 'absence_reason', type: 'text', nullable: true })
  absenceReason!: string | null;

  @Column({ name: 'rectifies_appointment_id', type: 'uuid', nullable: true })
  rectifiesAppointmentId!: string | null;

  @Column({ name: 'rectification_reason', type: 'text', nullable: true })
  rectificationReason!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', precision: 3 })
  createdAt!: Date;
}
