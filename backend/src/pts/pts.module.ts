import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccountsModule } from '../accounts/accounts.module';
import { PtsController } from './controllers/pts.controller';
import { PtsGoalsController } from './controllers/pts-goals.controller';
import { PtsHistoryController } from './controllers/pts-history.controller';
import { PtsGoalEntity } from './entities/pts-goal.entity';
import { PtsEntity } from './entities/pts.entity';
import { PtsGoalsRepository } from './repositories/pts-goals.repository';
import { PtsGoalsRepositoryImpl } from './repositories/pts-goals.repository.impl';
import { PtsRepository } from './repositories/pts.repository';
import { PtsRepositoryImpl } from './repositories/pts.repository.impl';
import { PtsGoalsService } from './services/pts-goals.service';
import { PtsService } from './services/pts.service';
import { Professional } from '../professionals/entities/professional.entity';
import { Patient } from '../patients/entities/patient.entity';
import { TimelineModule } from '../timeline/timeline.module';

@Module({
  imports: [
    AccountsModule,
    TypeOrmModule.forFeature([PtsEntity, PtsGoalEntity, Professional, Patient]),
    TimelineModule,
  ],
  controllers: [PtsController, PtsGoalsController, PtsHistoryController],
  providers: [
    PtsService,
    PtsGoalsService,
    { provide: PtsRepository, useClass: PtsRepositoryImpl },
    { provide: PtsGoalsRepository, useClass: PtsGoalsRepositoryImpl },
  ],
})
export class PtsModule {}
