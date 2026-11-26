import { Injectable } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';

import { NotificationEntity } from '../entities/notification.entity';

export interface ReviewWindowPts {
  ptsId: string;
  /** Próxima revisão, em yyyy-mm-dd. */
  reviewDate: string;
  patientName: string;
}

export interface ReviewWindowNotice {
  ptsId: string;
  reviewDate: string;
  message: string;
}

export interface FindNotificationsInput {
  accountId: string;
  unread: boolean;
  page: number;
  limit: number;
}

export type NotificationRow = Pick<
  NotificationEntity,
  'id' | 'type' | 'message' | 'ptsId' | 'createdAt' | 'readAt'
>;

@Injectable()
export class NotificationsRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findByAccount({
    accountId,
    unread,
    page,
    limit,
  }: FindNotificationsInput): Promise<{
    rows: NotificationRow[];
    total: number;
  }> {
    const [rows, total] = await this.notifications.findAndCount({
      where: {
        recipientAccountId: accountId,
        ...(unread && { readAt: IsNull() }),
      },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { rows, total };
  }

  async countUnread(accountId: string): Promise<number> {
    return this.notifications.countBy({
      recipientAccountId: accountId,
      readAt: IsNull(),
    });
  }

  /** Devolve null quando a notificação não existe ou é de outra conta. */
  async markAsRead(
    accountId: string,
    id: string,
  ): Promise<NotificationRow | null> {
    await this.notifications.update(
      { id, recipientAccountId: accountId, readAt: IsNull() },
      { readAt: () => 'now()' },
    );

    return this.notifications.findOneBy({ id, recipientAccountId: accountId });
  }

  async markAllAsRead(accountId: string): Promise<void> {
    await this.notifications.update(
      { recipientAccountId: accountId, readAt: IsNull() },
      { readAt: () => 'now()' },
    );
  }

  private get notifications() {
    return this.dataSource.getRepository(NotificationEntity);
  }

  async findPtsInReviewWindow(
    from: string,
    to: string,
  ): Promise<ReviewWindowPts[]> {
    return this.dataSource.query<ReviewWindowPts[]>(
      `SELECT pts.id AS "ptsId",
              to_char(pts.next_review_at, 'YYYY-MM-DD') AS "reviewDate",
              COALESCE(NULLIF(trim(account.social_name), ''), account.name) AS "patientName"
         FROM projeto_terapeutico_singular pts
         JOIN account ON account.id = pts.patient_id
        WHERE pts.status IN ('planning', 'running')
          AND pts.deleted_at IS NULL
          AND pts.next_review_at BETWEEN $1::date AND $2::date
          AND NOT EXISTS (
            SELECT 1 FROM notification
             WHERE notification.pts_id = pts.id
               AND notification.type = 'review_window'
               AND notification.review_date = pts.next_review_at
          )
        ORDER BY pts.next_review_at, pts.id`,
      [from, to],
    );
  }

  /** Avisa a equipe e o paciente; devolve quantos avisos foram criados. */
  async createReviewWindowNotices(notice: ReviewWindowNotice): Promise<number> {
    const { ptsId, reviewDate, message } = notice;

    return this.dataSource.transaction(async (manager) => {
      // Trava o PTS e refaz a checagem: encerramento ou mudança de data não passa.
      const locked = await manager.query<unknown[]>(
        `SELECT id FROM projeto_terapeutico_singular
          WHERE id = $1 AND next_review_at = $2::date
            AND status IN ('planning', 'running') AND deleted_at IS NULL
            FOR UPDATE`,
        [ptsId, reviewDate],
      );

      if (locked.length === 0) {
        return 0;
      }

      // Ciclo já avisado: quem entrou na equipe depois não recebe.
      const existing = await manager.query<unknown[]>(
        `SELECT id FROM notification
          WHERE pts_id = $1 AND type = 'review_window'
            AND review_date = $2::date LIMIT 1`,
        [ptsId, reviewDate],
      );

      if (existing.length > 0) {
        return 0;
      }

      const created = await manager.query<unknown[]>(
        `INSERT INTO notification
                (recipient_account_id, type, pts_id, message, review_date)
         SELECT account.id, 'review_window', $1::uuid, $3, $2::date
           FROM account
          WHERE account.role <> 'admin'
            AND account.status = 'active'
            AND account.id IN (
              SELECT pts.patient_id
                FROM projeto_terapeutico_singular pts WHERE pts.id = $1::uuid
              UNION
              SELECT professional.account_id
                FROM projeto_terapeutico_singular pts
                JOIN professional
                  ON professional.id = pts.responsible_professional_id
               WHERE pts.id = $1::uuid
              UNION
              SELECT professional.account_id
                FROM professional_participating_on_therapeutic_journey member
                JOIN professional ON professional.id = member.professional_id
               WHERE member.therapeutic_journey_id = $1::uuid
            )
         ON CONFLICT ON CONSTRAINT "UQ_notification_recipient_pts_review"
         DO NOTHING
         RETURNING id`,
        [ptsId, reviewDate, message],
      );

      return created.length;
    });
  }
}
