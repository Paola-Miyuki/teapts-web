import { member, seededGoalsRepo } from '../../pts/__tests__/goal-fixtures';
import { ActivitiesService } from '../services/activities.service';
import {
  activityBody,
  InMemoryActivitiesRepository,
} from '../__tests__/activity-fixtures';
import { ActivitiesController } from './activities.controller';

describe('ActivitiesController (RFACT001)', () => {
  it('cria pela conta da sessão e lista', async () => {
    const repo = new InMemoryActivitiesRepository();
    const controller = new ActivitiesController(
      new ActivitiesService(repo, seededGoalsRepo()),
    );

    const created = await controller.createActivity(
      'pts-1',
      activityBody(),
      member,
    );

    expect(created.status).toBe('suggested');
    expect(repo.created[0].executedByAccountId).toBe(member.accountId);
    expect(
      await controller.findActivities('pts-1', { page: 1, limit: 20 }, member),
    ).toMatchObject({
      data: [created],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });
});
