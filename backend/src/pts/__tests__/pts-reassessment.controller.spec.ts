import { PtsReassessmentController } from '../controllers/pts-reassessment.controller';
import { GoalStatus } from '../enums/goal.enums';
import { PtsReassessmentService } from '../services/pts-reassessment.service';
import { responsible, seededGoalsRepo } from './goal-fixtures';
import { InMemoryPtsReassessmentRepository } from './in-memory-pts-reassessment.repository';

describe('PtsReassessmentController (RFEVA005)', () => {
  it('registra pela conta da sessão', async () => {
    const repo = new InMemoryPtsReassessmentRepository();
    const controller = new PtsReassessmentController(
      new PtsReassessmentService(seededGoalsRepo(), repo),
    );

    const result = await controller.registerReassessment(
      'pts-1',
      {
        meetingDate: '2026-12-15',
        goals: [
          { goalId: 'goal-1', status: GoalStatus.Achieved },
          { goalId: 'goal-2', status: GoalStatus.NotAchieved },
        ],
        createNextVersion: false,
      },
      responsible,
    );

    expect(result).toEqual({
      id: 'pts-1',
      status: 'concluded',
      reassessedAt: '2026-12-15',
      nextPtsId: null,
    });
    expect(repo.registered[0].actor.accountId).toBe(responsible.accountId);
  });
});
