import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, ManyToMany, JoinTable } from 'typeorm';

export enum PtsStateEnum {
  DRAFT = 'draft',
  PLANNING = 'planning',
  RUNNING = 'running',
  CONCLUDED = 'concluded',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected',
}

@Entity('projeto_terapeutico_singular')
export class PtsEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', name: 'socialSituation' })
  socialSituation: string;

  @Column({
    type: 'enum',
    enum: PtsStateEnum,
    default: PtsStateEnum.DRAFT,
  })
  status: PtsStateEnum;

  @CreateDateColumn({ type: 'timestamp', name: 'createdAt' })
  createdAt: Date;

  @Column({ name: 'patient_id' })
  patientId: string;

  @Column({ name: 'responsible_professional_id' })
  responsibleProfessionalId: string;
}