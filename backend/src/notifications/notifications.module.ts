import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { NotificationsRepository } from './repositories/notifications.repository';
import { ReviewWindowService } from './services/review-window.service';
import { ReviewWindowTask } from './tasks/review-window.task';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [NotificationsRepository, ReviewWindowService, ReviewWindowTask],
})
export class NotificationsModule {}
