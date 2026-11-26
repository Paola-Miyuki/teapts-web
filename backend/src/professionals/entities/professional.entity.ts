import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  Unique,
} from 'typeorm';
import { Specialism } from '../enums/specialism.enum';
import { UFS, type Uf } from '../enums/uf.enum';
import { Account } from '../../accounts/entities/account.entity';

// Perfil profissional: no maximo um por conta (RN002).
@Entity('professional')
@Unique('UQ_professional_account', ['accountId'])
export class Professional {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_professional',
  })
  id!: string;

  @Column({ type: 'enum', enum: Specialism, enumName: 'specialism_e' })
  specialism!: Specialism;

  // Registro no conselho (o conselho vem da especialidade), instituição e
  // CNES; nulos nos perfis criados antes dos campos (RFPRO002).
  @Column('text', { name: 'council_number', nullable: true })
  councilNumber!: string | null;

  @Column({
    name: 'council_state',
    type: 'enum',
    enum: UFS,
    enumName: 'uf_e',
    nullable: true,
  })
  councilState!: Uf | null;

  @Column('text', { nullable: true })
  institution!: string | null;

  @Column('text', { nullable: true })
  cnes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', precision: 3 })
  createdAt!: Date;

  // O admin que criou e validou o perfil (RFPRO002); nulo nos perfis antigos.
  @Column('uuid', { name: 'created_by_account_id', nullable: true })
  createdByAccountId!: string | null;

  @Column({
    name: 'updated_at',
    type: 'timestamp',
    precision: 3,
    nullable: true,
  })
  updatedAt!: Date | null;

  @Index('IDX_professional_account_id')
  @Column('uuid', { name: 'account_id' })
  accountId!: string;

  @ManyToOne(() => Account, (account) => account.professionalProfiles, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'account_id',
    foreignKeyConstraintName: 'FK_professional_account',
  })
  account?: Relation<Account>;
}
