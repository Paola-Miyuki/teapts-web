import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  type Relation,
} from 'typeorm';

import { Account } from '../../accounts/entities/account.entity';
import { PtsEntity } from '../../pts/entities/pts.entity';
import { NotificationType } from '../enums/notification-type.enum';

/** Aviso dentro do app (RFNOT001). */
@Entity('notification')
@Index('IDX_notification_recipient', ['recipientAccountId'])
@Unique('UQ_notification_recipient_pts_review', [
  'recipientAccountId',
  'ptsId',
  'type',
  'reviewDate',
])
export class NotificationEntity {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'PK_notification',
  })
  id!: string;

  @Column({ name: 'recipient_account_id', type: 'uuid' })
  recipientAccountId!: string;

  @ManyToOne(() => Account)
  @JoinColumn({
    name: 'recipient_account_id',
    foreignKeyConstraintName: 'FK_notification_recipient_account',
  })
  recipient?: Relation<Account>;

  @Column({
    type: 'enum',
    enum: NotificationType,
    enumName: 'notification_type_e',
  })
  type!: NotificationType;

  @Column({ name: 'pts_id', type: 'uuid' })
  ptsId!: string;

  @ManyToOne(() => PtsEntity)
  @JoinColumn({
    name: 'pts_id',
    foreignKeyConstraintName: 'FK_notification_pts',
  })
  pts?: Relation<PtsEntity>;

  @Column({ type: 'text' })
  message!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', precision: 3 })
  createdAt!: Date;

  @Column({ name: 'read_at', type: 'timestamp', precision: 3, nullable: true })
  readAt!: Date | null;

  /** Próxima revisão a que o aviso se refere, em yyyy-mm-dd. */
  @Column({ name: 'review_date', type: 'date' })
  reviewDate!: string;
}
