import {
  InMemoryActivitiesRepository,
  storedActivity,
} from '../../activities/__tests__/activity-fixtures';
import { ActivityState } from '../../activities/enums/activity.enums';
import { member, seededGoalsRepo } from '../../pts/__tests__/goal-fixtures';
import {
  appointmentBody,
  InMemoryAppointmentsRepository,
} from '../__tests__/appointment-fixtures';
import { AppointmentsService } from '../services/appointments.service';
import { AppointmentsController } from './appointments.controller';

describe('AppointmentsController (RFACT004)', () => {
  it('registra pela conta da sessão e devolve o atendimento', async () => {
    const repo = new InMemoryAppointmentsRepository();
    const activities = new InMemoryActivitiesRepository();
    activities.activities.push(
      storedActivity({ status: ActivityState.Running }),
    );
    const controller = new AppointmentsController(
      new AppointmentsService(repo, activities, seededGoalsRepo()),
    );

    const created = await controller.createAppointment(
      'act-1',
      appointmentBody(),
      member,
    );

    expect(created).toMatchObject({ activityId: 'act-1', attendance: 'done' });
    expect(repo.created[0].executedByAccountId).toBe(member.accountId);
  });
});
