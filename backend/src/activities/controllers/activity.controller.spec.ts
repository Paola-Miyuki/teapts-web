import { member, seededGoalsRepo } from '../../pts/__tests__/goal-fixtures';
import { ActivitiesService } from '../services/activities.service';
import {
  InMemoryActivitiesRepository,
  storedActivity,
} from '../__tests__/activity-fixtures';
import { ActivityController } from './activity.controller';

describe('ActivityController (RFACT005)', () => {
  it('edita pela conta da sessão e devolve a atividade atualizada', async () => {
    const repo = new InMemoryActivitiesRepository();
    repo.activities.push(storedActivity());
    const controller = new ActivityController(
      new ActivitiesService(repo, seededGoalsRepo()),
    );

    const updated = await controller.updateActivity(
      'act-1',
      { title: 'Circuito sensorial' },
      member,
    );

    expect(updated).toMatchObject({
      id: 'act-1',
      title: 'Circuito sensorial',
      status: 'suggested',
      updatedAt: '2026-12-02T13:00:00.000Z',
    });
    expect(repo.updated[0].executedByAccountId).toBe(member.accountId);
  });
});