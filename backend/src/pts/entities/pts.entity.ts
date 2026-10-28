import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('projeto_terapeutico_singular')
export class PtsEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: 'draft' })
  status: string;

  @Column({ name: 'socialSituation', type: 'text', nullable: true })
  socialSituation: string;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @Column({ name: 'patient_id' })
  patientId: string;

  @Column({ name: 'responsible_professional_id' })
  responsibleProfessionalId: string;
}
