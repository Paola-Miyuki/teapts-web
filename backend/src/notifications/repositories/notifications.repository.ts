import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

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

@Injectable()
export class NotificationsRepository {
  constructor(private readonly dataSource: DataSource) {}

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
