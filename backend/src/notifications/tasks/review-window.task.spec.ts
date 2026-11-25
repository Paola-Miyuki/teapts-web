import { jest } from '@jest/globals';
import { ScheduleModule, SchedulerRegistry } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';

import { ReviewWindowService } from '../services/review-window.service';
import { ReviewWindowTask } from './review-window.task';

describe('ReviewWindowTask (RFNOT001)', () => {
  it('agenda a rotina uma vez por dia, no horário de Brasília', async () => {
    const notifyReviewWindows = jest.fn(async () => 0);
    const moduleRef = await Test.createTestingModule({
      imports: [ScheduleModule.forRoot()],
      providers: [
        ReviewWindowTask,
        { provide: ReviewWindowService, useValue: { notifyReviewWindows } },
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    app.useLogger(false);
    await app.init();

    const job = app.get(SchedulerRegistry).getCronJob('review-window');
    const [first, second] = job.nextDates(2);
    expect(second.diff(first, 'hours').hours).toBe(24);
    expect(first.zoneName).toBe('America/Sao_Paulo');

    await job.fireOnTick();
    expect(notifyReviewWindows).toHaveBeenCalledTimes(1);

    await app.close();
  });
});
