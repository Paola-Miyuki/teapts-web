import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TherapeuticPlansController } from './therapeutic-plans.controller';
import { TherapeuticPlansService } from './therapeutic-plans.service';
import { PtsEntity } from './entities/pts.entity';
import { Professional } from '../database/entities/professional.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PtsEntity, Professional])],
  controllers: [TherapeuticPlansController],
  providers: [TherapeuticPlansService],
  exports: [TherapeuticPlansService],
})
export class TherapeuticPlansModule {}