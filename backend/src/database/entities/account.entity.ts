import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { AccountRole } from '../enums/account-role.enum';

@Entity('account')
@Unique('UQ_account_email', ['email'])
export class Account {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_account' })
  id!: string;

  @Column('text')
  name!: string;

  @Column('text')
  email!: string;

  @Column('text', { name: 'password_hash' })
  passwordHash!: string;

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
}
