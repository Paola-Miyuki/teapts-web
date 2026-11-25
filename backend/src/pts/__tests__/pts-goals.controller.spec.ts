import { PtsGoalsController } from '../controllers/pts-goals.controller';
import { PtsGoalsService } from '../services/pts-goals.service';
import { goalBody, member, seededGoalsRepo } from './goal-fixtures';

describe('PtsGoalsController (RFPTS012)', () => {
  it('lista, cadastra, edita e exclui pela conta da sessão', async () => {
    const repo = seededGoalsRepo();
    const controller = new PtsGoalsController(new PtsGoalsService(repo));

    expect((await controller.findGoals('pts-1', member)).data).toHaveLength(2);

    const created = await controller.createGoal('pts-1', goalBody(), member);
    expect(created.title).toBe(goalBody().title);

    const updated = await controller.updateGoal(
      'pts-1',
      created.id,
      { title: 'Editada' },
      member,
    );
    expect(updated.title).toBe('Editada');

    expect(await controller.removeGoal('pts-1', created.id, member)).toEqual({
      status: 'OK',
    });
    expect(repo.removed[0].executedByAccountId).toBe(member.accountId);
  });
});
