import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('accounts') // essa classe representa a tabela accounts no bd
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true }) // garante que o superT seja unico, tal como email 
  @Column({ type: 'varchar', unique: true })
  supertokensUserId: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', unique: true })
  email: string;

  @Column({ type: 'varchar' })
  name: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
