import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { AccountsModule } from '../accounts/accounts.module';
import { NotificationsController } from './controllers/notifications.controller';
import { NotificationsRepository } from './repositories/notifications.repository';
import { NotificationsService } from './services/notifications.service';
import { ReviewWindowService } from './services/review-window.service';
import { ReviewWindowTask } from './tasks/review-window.task';

@Module({
  imports: [AccountsModule, ScheduleModule.forRoot()],
  controllers: [NotificationsController],
  providers: [
    NotificationsRepository,
    NotificationsService,
    ReviewWindowService,
    ReviewWindowTask,
  ],
})
export class NotificationsModule {}
