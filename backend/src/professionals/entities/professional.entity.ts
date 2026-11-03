import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  Unique,
} from 'typeorm';
import { Specialism } from '../enums/specialism.enum';
import { Account } from '../../accounts/entities/account.entity';

// Perfil profissional: uma conta pode ter varios, um por especialidade (RN002).
@Entity('professional')
@Unique('UQ_professional_account_specialism', ['accountId', 'specialism'])
export class Professional {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_professional',
  })
  id!: string;

  @Column({ type: 'enum', enum: Specialism, enumName: 'specialism_e' })
  specialism!: Specialism;

  @Index('IDX_professional_account_id')
  @Column('uuid', { name: 'accountId' })
  accountId!: string;

  @ManyToOne(() => Account, (account) => account.professionalProfiles, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'accountId',
    foreignKeyConstraintName: 'FK_professional_account',
  })
  account?: Relation<Account>;
}
