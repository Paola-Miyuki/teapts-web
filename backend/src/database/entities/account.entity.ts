import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  type Relation,
  Unique,
} from 'typeorm';
import { AccountRole } from '../enums/account-role.enum';
import { Patient } from './patient.entity';
import { Professional } from './professional.entity';

// A senha nao fica aqui: a identidade (e-mail + senha) e do SuperTokens, e a
// conta guarda so o vinculo `supertokensUserId` (RFAUT001).
@Entity('account')
@Unique('UQ_account_email', ['email'])
@Unique('UQ_account_supertokens_user_id', ['supertokensUserId'])
export class Account {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_account' })
  id!: string;

  @Column('text')
  name!: string;

  @Column('text')
  email!: string;

  @Column('text', { name: 'supertokens_user_id' })
  supertokensUserId!: string;

  @Column({
    name: 'last_updated_at',
    type: 'timestamp',
    precision: 3,
    nullable: true,
  })
  lastUpdatedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamp', precision: 3 })
  createdAt!: Date;

  @Column({
    type: 'enum',
    enum: AccountRole,
    enumName: 'account_role_e',
    default: AccountRole.User,
  })
  role!: AccountRole;

  // Relation<> evita a referencia circular entre entidades sob ESM.
  @OneToOne(() => Patient, (patient) => patient.account)
  patientProfile?: Relation<Patient> | null;

  @OneToMany(() => Professional, (professional) => professional.account)
  professionalProfiles?: Relation<Professional>[];
}
