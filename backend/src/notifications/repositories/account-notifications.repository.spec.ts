import { jest } from '@jest/globals';
import { IsNull, type DataSource } from 'typeorm';

import { NotificationsRepository } from './notifications.repository';

function setup() {
  const orm = {
    findAndCount: jest.fn(async () => [[{ id: 'n-1' }], 1]),
    countBy: jest.fn(async () => 2),
    update: jest.fn<
      (where: unknown, values: { readAt: () => string }) => Promise<void>
    >(async () => undefined),
    findOneBy: jest.fn(async () => null),
  };

  return {
    orm,
    repository: new NotificationsRepository({
      getRepository: () => orm,
    } as unknown as DataSource),
  };
}

describe('NotificationsRepository: consulta da conta (RFNOT002)', () => {
  it('pagina da mais recente à mais antiga, só da conta', async () => {
    const { orm, repository } = setup();

    expect(
      await repository.findByAccount({
        accountId: 'acc-1',
        unread: false,
        page: 3,
        limit: 10,
      }),
    ).toEqual({ rows: [{ id: 'n-1' }], total: 1 });
    expect(orm.findAndCount).toHaveBeenCalledWith({
      where: { recipientAccountId: 'acc-1' },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: 20,
      take: 10,
    });
  });

  it('filtra e conta as não lidas', async () => {
    const { orm, repository } = setup();
    const unread = { recipientAccountId: 'acc-1', readAt: IsNull() };

    await repository.findByAccount({
      accountId: 'acc-1',
      unread: true,
      page: 1,
      limit: 10,
    });

    expect(orm.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: unread }),
    );
    expect(await repository.countUnread('acc-1')).toBe(2);
    expect(orm.countBy).toHaveBeenCalledWith(unread);
  });

  it('só grava a leitura na não lida da própria conta', async () => {
    const { orm, repository } = setup();

    expect(await repository.markAsRead('acc-1', 'n-1')).toBeNull();
    await repository.markAllAsRead('acc-1');

    const [[one, values], [all]] = orm.update.mock.calls;
    expect(one).toEqual({
      id: 'n-1',
      recipientAccountId: 'acc-1',
      readAt: IsNull(),
    });
    expect(values.readAt()).toBe('now()');
    expect(all).toEqual({ recipientAccountId: 'acc-1', readAt: IsNull() });
    expect(orm.findOneBy).toHaveBeenCalledWith({
      id: 'n-1',
      recipientAccountId: 'acc-1',
    });
  });
});
