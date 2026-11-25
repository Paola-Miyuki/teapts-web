import { Injectable } from '@nestjs/common';

import type { AccountContext } from '../../accounts/services/accounts.service';
import { toPagination } from '../../common/pagination/pagination';
import type { GetNotificationsQueryDto } from '../dto/get-notifications-query.dto';
import type {
  GetNotificationsResponseDto,
  NotificationResponseDto,
  ReadAllResponseDto,
  UnreadCountResponseDto,
} from '../dto/notification-response.dto';
import { notificationNotFound } from '../notifications.errors';
import {
  NotificationsRepository,
  type NotificationRow,
} from '../repositories/notifications.repository';

function toResponse(row: NotificationRow): NotificationResponseDto {
  return {
    id: row.id,
    type: row.type,
    message: row.message,
    ptsId: row.ptsId,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
  };
}

@Injectable()
export class NotificationsService {
  constructor(private readonly repository: NotificationsRepository) {}

  async findNotifications(
    query: GetNotificationsQueryDto,
    account: AccountContext,
  ): Promise<GetNotificationsResponseDto> {
    const [{ rows, total }, unreadCount] = await Promise.all([
      this.repository.findByAccount({
        accountId: account.accountId,
        unread: query.unread ?? false,
        page: query.page,
        limit: query.limit,
      }),
      this.repository.countUnread(account.accountId),
    ]);

    return {
      data: rows.map(toResponse),
      pagination: toPagination(query, total),
      unreadCount,
    };
  }

  async countUnread(account: AccountContext): Promise<UnreadCountResponseDto> {
    return {
      unreadCount: await this.repository.countUnread(account.accountId),
    };
  }

  async markAsRead(
    id: string,
    account: AccountContext,
  ): Promise<NotificationResponseDto> {
    const notification = await this.repository.markAsRead(
      account.accountId,
      id,
    );

    if (!notification) {
      throw notificationNotFound();
    }

    return toResponse(notification);
  }

  async markAllAsRead(account: AccountContext): Promise<ReadAllResponseDto> {
    await this.repository.markAllAsRead(account.accountId);

    return { status: 'OK' };
  }
}
