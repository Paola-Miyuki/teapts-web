import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PtsController } from './controllers/pts.controller';
import { PtsEntity } from './entities/pts.entity';
import { PtsRepository } from './repositories/pts.repository';
import { PtsRepositoryImpl } from './repositories/pts.repository.impl';
import { PtsService } from './services/pts.service';
import { Professional } from '../professionals/entities/professional.entity';
import { Patient } from '../patients/entities/patient.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PtsEntity, Professional, Patient])],
  controllers: [PtsController],
  providers: [
    PtsService,
    { provide: PtsRepository, useClass: PtsRepositoryImpl },
  ],
})
export class PtsModule {}