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
import { SupportContact } from './support-contact.entity';

// Perfil de paciente: no maximo um por conta, por isso a PK e o proprio
// account_id (RN002).
@Entity('patient')
@Unique('UQ_patient_cns', ['cns'])
export class Patient {
  @PrimaryColumn('uuid', {
    name: 'account_id',
    primaryKeyConstraintName: 'PK_patient',
  })
  accountId!: string;

  // CNS e responsavel tutelar ficam nulos ate o cadastro completo (RFPAC001).
  @Column('text', { nullable: true })
  cns!: string | null;

  @Column('text', { name: 'guardian_name', nullable: true })
  guardianName!: string | null;

  // Quando a conta virou paciente; alimenta o filtro e a ordenacao da lista.
  @Column({
    name: 'registered_at',
    type: 'timestamp',
    precision: 3,
    default: () => 'now()',
  })
  registeredAt!: Date;

  // RESTRICT: a conta do paciente nao e apagada, so desativada (RN021).
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
}
