import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PtsStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  INACTIVE = 'INACTIVE',
}

@Entity('pts')
export class PtsEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  patientId: number;

  @Column({ type: 'uuid' })
  responsibleProfessionalId: string;

  @Column({ type: 'text' })
  socialSituation: string;

  @Column({
    type: 'varchar',
    default: PtsStatus.DRAFT,
  })
  status: PtsStatus;

  @Column('uuid', { array: true, default: '{}' })
  teamProfessionalIds: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}