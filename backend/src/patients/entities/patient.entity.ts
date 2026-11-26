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
import { UFS, type Uf } from '../../professionals/enums/uf.enum';
import { EducationLevel } from '../enums/education-level.enum';
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

  @Column('text', { name: 'guardian_phone', nullable: true })
  guardianPhone!: string | null;

  // Endereço (RFPAC001): nulo só nos pacientes anteriores aos campos.
  @Column('text', { name: 'address_zip_code', nullable: true })
  addressZipCode!: string | null;

  @Column('text', { name: 'address_street', nullable: true })
  addressStreet!: string | null;

  @Column('text', { name: 'address_number', nullable: true })
  addressNumber!: string | null;

  @Column('text', { name: 'address_complement', nullable: true })
  addressComplement!: string | null;

  @Column('text', { name: 'address_district', nullable: true })
  addressDistrict!: string | null;

  @Column('text', { name: 'address_city', nullable: true })
  addressCity!: string | null;

  @Column({
    name: 'address_state',
    type: 'enum',
    enum: UFS,
    enumName: 'uf_e',
    nullable: true,
  })
  addressState!: Uf | null;

  @Column('text', { name: 'filiation_1', nullable: true })
  filiation1!: string | null;

  @Column('text', { name: 'filiation_2', nullable: true })
  filiation2!: string | null;

  @Column({
    name: 'education_level',
    type: 'enum',
    enum: EducationLevel,
    enumName: 'education_level_e',
    nullable: true,
  })
  educationLevel!: EducationLevel | null;

  @Column('text', { name: 'school_name', nullable: true })
  schoolName!: string | null;

  @Column('text', { name: 'reference_unit', nullable: true })
  referenceUnit!: string | null;

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
