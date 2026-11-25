import { jest } from '@jest/globals';
import { Logger } from '@nestjs/common';

import type {
  NotificationsRepository,
  ReviewWindowPts,
} from '../repositories/notifications.repository';
import { ReviewWindowService } from './review-window.service';

const pts = (
  ptsId: string,
  reviewDate: string,
  patientName = 'Lívia',
): ReviewWindowPts => ({ ptsId, reviewDate, patientName });

describe('ReviewWindowService (RFNOT001)', () => {
  const now = new Date('2026-11-03T12:00:00.000Z');

  function setup(found: ReviewWindowPts[]) {
    const repository = {
      findPtsInReviewWindow: jest.fn<
        NotificationsRepository['findPtsInReviewWindow']
      >(async () => found),
      createReviewWindowNotices: jest.fn<
        NotificationsRepository['createReviewWindowNotices']
      >(async () => 3),
    };

    return {
      repository,
      service: new ReviewWindowService(
        repository as unknown as NotificationsRepository,
      ),
    };
  }

  it('busca de hoje até 30 dias à frente e avisa com a data máxima', async () => {
    const { repository, service } = setup([pts('pts-1', '2026-12-03')]);

    const created = await service.notifyReviewWindows(now);

    expect(repository.findPtsInReviewWindow).toHaveBeenCalledWith(
      '2026-11-03',
      '2026-12-03',
    );
    expect(repository.createReviewWindowNotices).toHaveBeenCalledWith({
      ptsId: 'pts-1',
      reviewDate: '2026-12-03',
      message: 'A reavaliação do PTS de Lívia vence em 30 dias (03/12/2026).',
    });
    expect(created).toBe(3);
  });

  it.each([
    ['2026-11-13', 'vence em 10 dias (13/11/2026).'],
    ['2026-11-04', 'vence em 1 dia (04/11/2026).'],
    ['2026-11-03', 'vence hoje (03/11/2026).'],
  ])('com %s, o aviso atrasado diz "%s"', async (date, text) => {
    const { repository, service } = setup([pts('pts-1', date)]);

    await service.notifyReviewWindows(now);

    expect(repository.createReviewWindowNotices.mock.calls[0][0].message).toBe(
      `A reavaliação do PTS de Lívia ${text}`,
    );
  });

  it('usa o dia do horário de Brasília', async () => {
    const { repository, service } = setup([]);

    await service.notifyReviewWindows(new Date('2026-11-04T01:00:00.000Z'));

    expect(repository.findPtsInReviewWindow).toHaveBeenCalledWith(
      '2026-11-03',
      '2026-12-03',
    );
  });

  it('a falha de um PTS vai para o log e não para a rotina', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { repository, service } = setup([
      pts('pts-1', '2026-12-03', 'Nome Sigiloso'),
      pts('pts-2', '2026-12-03'),
    ]);
    repository.createReviewWindowNotices.mockRejectedValueOnce(
      new Error('banco fora'),
    );

    expect(await service.notifyReviewWindows(now)).toBe(3);
    expect(repository.createReviewWindowNotices).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][0])).toContain('pts-1');
    expect(JSON.stringify(log.mock.calls)).not.toContain('Nome Sigiloso');
  });
});
