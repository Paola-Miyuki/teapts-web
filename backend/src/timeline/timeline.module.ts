import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PtsEntity } from '../pts/entities/pts.entity';
import { TimelineController } from './controllers/timeline.controller';
import { TimelineRecordEntity } from './entities/timeline-record.entity';
import { TimelineRepository } from './repositories/timeline.repository';
import { TimelineRepositoryImpl } from './repositories/timeline.repository.impl';
import { TimelineRecorderService } from './services/timeline-recorder.service';
import { TimelineService } from './services/timeline.service';

@Module({
  imports: [TypeOrmModule.forFeature([TimelineRecordEntity, PtsEntity])],
  controllers: [TimelineController],
  providers: [
    TimelineService,
    TimelineRecorderService,
    { provide: TimelineRepository, useClass: TimelineRepositoryImpl },
  ],
  exports: [TimelineRecorderService],
})
export class TimelineModule {}
