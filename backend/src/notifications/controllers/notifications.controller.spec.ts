import { jest } from '@jest/globals';

import { accountOf } from '../../pts/__tests__/goal-fixtures';
import type { NotificationsService } from '../services/notifications.service';
import { NotificationsController } from './notifications.controller';

describe('NotificationsController (RFNOT002)', () => {
  const account = accountOf();

  it('repassa a query, o id e a conta da sessão', async () => {
    const service = {
      findNotifications: jest.fn(),
      countUnread: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
    };
    const controller = new NotificationsController(
      service as unknown as NotificationsService,
    );
    const query = { page: 1, limit: 20 };

    await controller.findNotifications(query, account);
    await controller.countUnread(account);
    await controller.markAsRead('n-1', account);
    await controller.markAllAsRead(account);

    expect(service.findNotifications).toHaveBeenCalledWith(query, account);
    expect(service.countUnread).toHaveBeenCalledWith(account);
    expect(service.markAsRead).toHaveBeenCalledWith('n-1', account);
    expect(service.markAllAsRead).toHaveBeenCalledWith(account);
  });
});
