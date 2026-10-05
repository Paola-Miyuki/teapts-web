import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { Account } from './account.entity';

// Perfil de paciente: no maximo um por conta, por isso a PK e o proprio
// accountId (RN002).
@Entity('patient')
export class Patient {
  @PrimaryColumn('uuid', {
    name: 'accountId',
    primaryKeyConstraintName: 'PK_patient',
  })
  accountId!: string;

  @Column('jsonb', { array: true, default: () => "'{}'" })
  supportContacts!: Record<string, unknown>[];

  @OneToOne(() => Account, (account) => account.patientProfile, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'accountId',
    foreignKeyConstraintName: 'FK_patient_account',
  })
  account?: Relation<Account>;
}
