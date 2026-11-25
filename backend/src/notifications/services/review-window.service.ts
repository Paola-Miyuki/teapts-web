import { Injectable, Logger } from '@nestjs/common';

import { NotificationsRepository } from '../repositories/notifications.repository';

// A janela de reavaliação abre 30 dias antes da data máxima (RN031).
const REVIEW_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export const REVIEW_TIME_ZONE = 'America/Sao_Paulo';

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildMessage(
  patientName: string,
  reviewDate: string,
  today: string,
): string {
  const days = Math.round(
    (Date.parse(reviewDate) - Date.parse(today)) / DAY_MS,
  );
  const when =
    days === 0 ? 'hoje' : `em ${days} ${days === 1 ? 'dia' : 'dias'}`;
  const [year, month, day] = reviewDate.split('-');

  return `A reavaliação do PTS de ${patientName} vence ${when} (${day}/${month}/${year}).`;
}

@Injectable()
export class ReviewWindowService {
  private readonly logger = new Logger(ReviewWindowService.name);

  constructor(private readonly repository: NotificationsRepository) {}

  /** Cria os avisos que faltam (RFNOT001); devolve quantos foram criados. */
  async notifyReviewWindows(now = new Date()): Promise<number> {
    // en-CA formata em yyyy-mm-dd.
    const today = now.toLocaleDateString('en-CA', {
      timeZone: REVIEW_TIME_ZONE,
    });
    const limit = toDateOnly(
      new Date(Date.parse(today) + REVIEW_WINDOW_DAYS * DAY_MS),
    );
    const found = await this.repository.findPtsInReviewWindow(today, limit);
    let created = 0;

    for (const { ptsId, reviewDate, patientName } of found) {
      try {
        created += await this.repository.createReviewWindowNotices({
          ptsId,
          reviewDate,
          message: buildMessage(patientName, reviewDate, today),
        });
      } catch (error) {
        // Sem o nome do paciente no log.
        this.logger.error(
          `Falha ao avisar a janela de reavaliação do PTS ${ptsId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    return created;
  }
}
