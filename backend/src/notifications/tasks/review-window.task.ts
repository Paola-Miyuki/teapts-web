import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import {
  REVIEW_TIME_ZONE,
  ReviewWindowService,
} from '../services/review-window.service';

@Injectable()
export class ReviewWindowTask {
  private readonly logger = new Logger(ReviewWindowTask.name);

  constructor(private readonly reviewWindowService: ReviewWindowService) {}

  @Cron('0 6 * * *', { name: 'review-window', timeZone: REVIEW_TIME_ZONE })
  async run(): Promise<void> {
    const created = await this.reviewWindowService.notifyReviewWindows();

    this.logger.log(`Avisos de reavaliação criados: ${created}`);
  }
}
