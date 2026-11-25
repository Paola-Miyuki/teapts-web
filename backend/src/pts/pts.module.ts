import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccountsModule } from '../accounts/accounts.module';
import { PtsController } from './controllers/pts.controller';
import { PtsHistoryController } from './controllers/pts-history.controller';
import { PtsEntity } from './entities/pts.entity';
import { PtsRepository } from './repositories/pts.repository';
import { PtsRepositoryImpl } from './repositories/pts.repository.impl';
import { PtsService } from './services/pts.service';
import { Professional } from '../professionals/entities/professional.entity';
import { Patient } from '../patients/entities/patient.entity';
import { TimelineModule } from '../timeline/timeline.module';

@Module({
  imports: [
    AccountsModule,
    TypeOrmModule.forFeature([PtsEntity, Professional, Patient]),
    TimelineModule,
  ],
  controllers: [PtsController, PtsHistoryController],
  providers: [
    PtsService,
    { provide: PtsRepository, useClass: PtsRepositoryImpl },
  ],
})
export class PtsModule {}
