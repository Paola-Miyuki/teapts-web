import { Module } from '@nestjs/common';
import { PtsController } from './pts.controller';
import { PtsRepository } from './pts.repository';
import { PtsRepositoryImpl } from './pts.repository.impl';
import { PtsService } from './pts.service';

@Module({
  controllers: [PtsController],
  providers: [PtsService, { provide: PtsRepository, useClass: PtsRepositoryImpl }],
})
export class PtsModule {}
