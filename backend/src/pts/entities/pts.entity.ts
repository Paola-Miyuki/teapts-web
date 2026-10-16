import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, ManyToMany, JoinTable, CreateDateColumn } from 'typeorm';
import { Patient } from '../../database/entities/patient.entity';
import { Professional } from '../../database/entities/professional.entity';

@Entity('pts')
export class PtsEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  status: string;

  @Column()
  socialSituation: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column()
  patientId: string;

  @ManyToOne(() => Patient, { eager: true })
  patient: Patient;

  @Column()
  responsibleProfessionalId: string;

  @ManyToOne(() => Professional, { eager: true })
  responsible: Professional;

  @ManyToMany(() => Professional, { eager: true })
  @JoinTable()
  team: Professional[];
}