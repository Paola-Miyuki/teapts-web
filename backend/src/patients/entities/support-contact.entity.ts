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

// Contato de suporte do paciente (RFPAC001). Nao concede tutela nem acesso
// (RN017).
@Entity('support_contact')
export class SupportContact {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_support_contact',
  })
  id!: string;

  @Index('IDX_support_contact_patient_id')
  @Column('uuid', { name: 'patient_id' })
  patientId!: string;

  @ManyToOne(() => Patient, (patient) => patient.supportContacts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'patient_id',
    referencedColumnName: 'accountId',
    foreignKeyConstraintName: 'FK_support_contact_patient',
  })
  patient?: Relation<Patient>;

  @Column('text')
  name!: string;

  @Column('text', { nullable: true })
  description!: string | null;

  @Column('text', { nullable: true })
  email!: string | null;

  @Column('text', { nullable: true })
  phone!: string | null;

  @Column('boolean', { name: 'is_emergency', default: false })
  isEmergency!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', precision: 3 })
  createdAt!: Date;

  @Column({
    name: 'updated_at',
    type: 'timestamp',
    precision: 3,
    nullable: true,
  })
  updatedAt!: Date | null;
}
