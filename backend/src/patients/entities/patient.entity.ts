import {
  Column,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryColumn,
  type Relation,
  Unique,
} from 'typeorm';
import { Account } from '../../accounts/entities/account.entity';
import { Medication } from './medication.entity';
import { SupportContact } from './support-contact.entity';

@Entity('patient')
@Unique('UQ_patient_cns', ['cns'])
export class Patient {
  @PrimaryColumn('uuid', {
    name: 'account_id',
    primaryKeyConstraintName: 'PK_patient',
  })
  accountId!: string;

  @Column('text', { nullable: true })
  cns!: string | null;

  @Column('text', { name: 'guardian_name', nullable: true })
  guardianName!: string | null;

  @Column('text', { nullable: true })
  allergies!: string | null;

  @Column('boolean', {
    name: 'no_known_allergies',
    default: false,
  })
  noKnownAllergies!: boolean;

  @Column('text', { name: 'clinical_history', nullable: true })
  clinicalHistory!: string | null;

  @Column('text', { name: 'surgical_history', nullable: true })
  surgicalHistory!: string | null;

  @Column('text', { name: 'family_history', nullable: true })
  familyHistory!: string | null;

  @Column('text', { nullable: true })
  habits!: string | null;

  @Column('text', {
    name: 'developmental_milestones',
    nullable: true,
  })
  developmentalMilestones!: string | null;

  @Column({
    name: 'updated_at',
    type: 'timestamp',
    precision: 3,
    nullable: true,
  })
  updatedAt!: Date | null;

  @Column('uuid', {
    name: 'updated_by_account_id',
    nullable: true,
  })
  updatedByAccountId!: string | null;

  @Column({
    name: 'registered_at',
    type: 'timestamp',
    precision: 3,
    default: () => 'now()',
  })
  registeredAt!: Date;

  @OneToOne(() => Account, (account) => account.patientProfile, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'account_id',
    foreignKeyConstraintName: 'FK_patient_account',
  })
  account?: Relation<Account>;

  @OneToMany(() => SupportContact, (contact) => contact.patient)
  supportContacts?: Relation<SupportContact>[];

  @OneToMany(() => Medication, (medication) => medication.patient)
  medications?: Relation<Medication>[];
}
