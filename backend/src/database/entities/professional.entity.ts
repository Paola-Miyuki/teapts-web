import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Specialism } from '../enums/specialism.enum';
import { Account } from './account.entity';

// Perfil profissional: uma conta pode ter varios (RN002).
@Entity('professional')
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
