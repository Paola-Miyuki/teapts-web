import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';

import { ActivityEntity } from './activity.entity';

/** Documento associado à atividade, do mesmo paciente do PTS (RN013). */
@Entity('activity_document')
export class ActivityDocumentEntity {
  @PrimaryColumn({
    name: 'activity_id',
    type: 'uuid',
    primaryKeyConstraintName: 'PK_activity_document',
  })
  activityId!: string;

  @PrimaryColumn({
    name: 'document_id',
    type: 'uuid',
    primaryKeyConstraintName: 'PK_activity_document',
  })
  documentId!: string;

  @ManyToOne(() => ActivityEntity, (activity) => activity.documents)
  @JoinColumn({
    name: 'activity_id',
    foreignKeyConstraintName: 'FK_activity_document_activity',
  })
  activity?: Relation<ActivityEntity>;

  @CreateDateColumn({ name: 'linked_at', type: 'timestamp', precision: 3 })
  linkedAt!: Date;
}
