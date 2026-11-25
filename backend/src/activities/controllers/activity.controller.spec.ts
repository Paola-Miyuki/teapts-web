import { member, seededGoalsRepo } from '../../pts/__tests__/goal-fixtures';
import { ActivitiesService } from '../services/activities.service';
import {
  InMemoryActivitiesRepository,
  storedActivity,
} from '../__tests__/activity-fixtures';
import { ActivityController } from './activity.controller';

describe('ActivityController (RFACT005)', () => {
  it('consulta uma atividade pelo id e devolve o detalhe', async () => {
    const repo = new InMemoryActivitiesRepository();
    repo.activities.push(
      storedActivity({ goalId: 'goal-1', documentIds: ['doc-1'] }),
    );
    const controller = new ActivityController(
      new ActivitiesService(repo, seededGoalsRepo()),
    );

    await expect(
      controller.findActivityById('act-1', member),
    ).resolves.toMatchObject({
      id: 'act-1',
      goal: { id: 'goal-1', title: 'Meta terapêutica' },
      documents: [{ id: 'doc-1', title: 'Documento doc-1' }],
      appointmentsCount: 0,
    });
  });

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
