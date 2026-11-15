import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Professional } from '../../professionals/entities/professional.entity';
import { PtsEntity } from '../../pts/entities/pts.entity';
import { TimelineRecordTarget } from '../enums/timeline-record-target.enum';
import { TimelineRecordType } from '../enums/timeline-record-type.enum';

/** Evento do histórico de um PTS (RFTL001). Registros não são editados. */
@Entity('timeline_record')
export class TimelineRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: TimelineRecordType,
    enumName: 'timeline_record_type_e',
  })
  type: TimelineRecordType;

  @Column({ type: 'text' })
  description: string;

  @CreateDateColumn({ type: 'timestamp', precision: 3 })
  happenedAt: Date;

  @Column({ type: 'uuid' })
  targetId: string;

  @Column({
    type: 'enum',
    enum: TimelineRecordTarget,
    enumName: 'timeline_record_target_e',
  })
  targetType: TimelineRecordTarget;

  @Column({ name: 'projeto_terapeutico_singular_id', type: 'uuid' })
  projetoTerapeuticoSingularId: string;

  @ManyToOne(() => PtsEntity)
  @JoinColumn({ name: 'projeto_terapeutico_singular_id' })
  projetoTerapeuticoSingular?: PtsEntity;

  // Autor do evento. Fica nulo quando a ação não parte de um profissional
  // (por exemplo, o admin).
  @Column({ name: 'author_professional_id', type: 'uuid', nullable: true })
  authorProfessionalId: string | null;

  @ManyToOne(() => Professional, { nullable: true })
  @JoinColumn({ name: 'author_professional_id' })
  authorProfessional?: Professional | null;
}
