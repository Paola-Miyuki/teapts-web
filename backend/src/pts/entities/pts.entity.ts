import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  ManyToMany,
  JoinTable,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Patient } from '../../patients/entities/patient.entity';
import { Professional } from '../../professionals/entities/professional.entity';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';

@Entity('projeto_terapeutico_singular')
export class PtsEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: PtsStateEnum,
    enumName: 'pts_state_e',
  })
  status: PtsStateEnum;

  @Column()
  socialSituation: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient, { eager: true })
  @JoinColumn({ name: 'patient_id', referencedColumnName: 'accountId' })
  patient: Patient;

  @Column({ name: 'responsible_professional_id' })
  responsibleProfessionalId: string;

  @ManyToOne(() => Professional, { eager: true })
  @JoinColumn({
    name: 'responsible_professional_id',
    referencedColumnName: 'id',
  })
  responsible: Professional;

  @ManyToMany(() => Professional, { eager: true })
  @JoinTable({
    name: 'professional_participating_on_therapeutic_journey',
    joinColumn: {
      name: 'therapeutic_journey_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'professional_id',
      referencedColumnName: 'id',
    },
  })
  team: Professional[];
}
