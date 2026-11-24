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
import { Patient } from './patient.entity';

// Medicacao de uso continuo do paciente (RFPAC007).
// Suspender preenche end_date; o registro nao e apagado.
@Entity('medication')
export class Medication {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_medication',
  })
  id!: string;

  @Index('IDX_medication_patient_id')
  @Column('uuid', { name: 'patient_id' })
  patientId!: string;

  @ManyToOne(() => Patient, (patient) => patient.medications)
  @JoinColumn({
    name: 'patient_id',
    referencedColumnName: 'accountId',
    foreignKeyConstraintName: 'FK_medication_patient',
  })
  patient?: Relation<Patient>;

  @Column('text', { name: 'drug_name' })
  drugName!: string;

  @Column('text')
  dose!: string;

  @Column('text')
  frequency!: string;

  @Column('text', { nullable: true })
  prescriber!: string | null;

  @Column('text', { nullable: true })
  reason!: string | null;

  @Column('date', { name: 'start_date' })
  startDate!: string;

  @Column('date', { name: 'end_date', nullable: true })
  endDate!: string | null;

  @Column('uuid', { name: 'registered_by_account_id' })
  registeredByAccountId!: string;

  @Column('uuid', { name: 'stopped_by_account_id', nullable: true })
  stoppedByAccountId!: string | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    precision: 3,
  })
  createdAt!: Date;

  @Column({
    name: 'updated_at',
    type: 'timestamp',
    precision: 3,
    nullable: true,
  })
  updatedAt!: Date | null;
}
