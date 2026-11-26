import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccountsModule } from '../accounts/accounts.module';
import { PtsModule } from '../pts/pts.module';
import { TimelineModule } from '../timeline/timeline.module';
import { ActivitiesController } from './controllers/activities.controller';
import { ActivityController } from './controllers/activity.controller';
import { ActivityDocumentEntity } from './entities/activity-document.entity';
import { ActivityEntity } from './entities/activity.entity';
import { ActivitiesRepository } from './repositories/activities.repository';
import { ActivitiesRepositoryImpl } from './repositories/activities.repository.impl';
import { ActivitiesService } from './services/activities.service';

@Module({
  imports: [
    AccountsModule,
    PtsModule,
    TimelineModule,
    TypeOrmModule.forFeature([ActivityEntity, ActivityDocumentEntity]),
  ],
  controllers: [ActivitiesController, ActivityController],
  providers: [
    ActivitiesService,
    { provide: ActivitiesRepository, useClass: ActivitiesRepositoryImpl },
  ],
  exports: [ActivitiesRepository],
})
export class ActivitiesModule {}
