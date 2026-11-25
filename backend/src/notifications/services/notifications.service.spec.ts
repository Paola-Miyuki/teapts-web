import { jest } from '@jest/globals';

import { accountOf } from '../../pts/__tests__/goal-fixtures';
import { expectApiError } from '../../pts/__tests__/test-utils';
import { NotificationType } from '../enums/notification-type.enum';
import type { NotificationsRepository } from '../repositories/notifications.repository';
import { NotificationsService } from './notifications.service';

const row = (readAt: Date | null = null) => ({
  id: 'n-1',
  type: NotificationType.ReviewWindow,
  message: 'A reavaliação do PTS de Lívia vence em 30 dias (18/12/2026).',
  ptsId: 'pts-1',
  createdAt: new Date('2026-11-18T09:00:00.000Z'),
  readAt,
});

function setup(found: ReturnType<typeof row> | null = row()) {
  const repository = {
    findByAccount: jest.fn<NotificationsRepository['findByAccount']>(
      async () => ({ rows: [row()], total: 21 }),
    ),
    countUnread: jest.fn<NotificationsRepository['countUnread']>(async () => 4),
    markAsRead: jest.fn<NotificationsRepository['markAsRead']>(
      async () => found,
    ),
    markAllAsRead: jest.fn<NotificationsRepository['markAllAsRead']>(
      async () => undefined,
    ),
  };

  return {
    repository,
    service: new NotificationsService(
      repository as unknown as NotificationsRepository,
    ),
  };
}

const account = accountOf();

describe('NotificationsService (RFNOT002)', () => {
  it('lista só as da conta, com a paginação e o total de não lidas', async () => {
    const { repository, service } = setup();

    const result = await service.findNotifications(
      { unread: true, page: 2, limit: 20 },
      account,
    );

    expect(repository.findByAccount).toHaveBeenCalledWith({
      accountId: 'acc-1',
      unread: true,
      page: 2,
      limit: 20,
    });
    expect(repository.countUnread).toHaveBeenCalledWith('acc-1');
    expect(result).toEqual({
      data: [
        {
          ...row(),
          createdAt: '2026-11-18T09:00:00.000Z',
          readAt: null,
        },
      ],
      pagination: { page: 2, limit: 20, total: 21, totalPages: 2 },
      unreadCount: 4,
    });
  });

  it('conta as não lidas da conta', async () => {
    const { repository, service } = setup();

    expect(await service.countUnread(account)).toEqual({ unreadCount: 4 });
    expect(repository.countUnread).toHaveBeenCalledWith('acc-1');
  });

  it('marca como lida e devolve a data de leitura', async () => {
    const { repository, service } = setup(
      row(new Date('2026-11-19T10:00:00.000Z')),
    );

    expect(await service.markAsRead('n-1', account)).toMatchObject({
      id: 'n-1',
      readAt: '2026-11-19T10:00:00.000Z',
    });
    expect(repository.markAsRead).toHaveBeenCalledWith('acc-1', 'n-1');
  });

  it('responde 404 quando não existe ou é de outra conta', async () => {
    const { service } = setup(null);

    const error = await expectApiError(
      () => service.markAsRead('n-1', account),
      404,
      'NOTIFICATION_NOT_FOUND',
    );
    expect(error.message).toBe('Notificação não encontrada.');
  });

  it('marca todas da conta como lidas', async () => {
    const { repository, service } = setup();

    expect(await service.markAllAsRead(account)).toEqual({ status: 'OK' });
    expect(repository.markAllAsRead).toHaveBeenCalledWith('acc-1');
  });
});
