import { Module } from '@nestjs/common';

import { AccountsModule } from '../accounts/accounts.module';
import { ActivitiesModule } from '../activities/activities.module';
import { PtsModule } from '../pts/pts.module';
import { TimelineModule } from '../timeline/timeline.module';
import { AppointmentController } from './controllers/appointment.controller';
import { AppointmentsController } from './controllers/appointments.controller';
import { AppointmentsRepository } from './repositories/appointments.repository';
import { AppointmentsRepositoryImpl } from './repositories/appointments.repository.impl';
import { AppointmentsService } from './services/appointments.service';

@Module({
  imports: [AccountsModule, ActivitiesModule, PtsModule, TimelineModule],
  controllers: [AppointmentsController, AppointmentController],
  providers: [
    AppointmentsService,
    { provide: AppointmentsRepository, useClass: AppointmentsRepositoryImpl },
  ],
})
export class AppointmentsModule {}
