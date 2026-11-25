import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import type { RegisterReassessmentRequestDto } from '../dto/register-reassessment.dto';
import { GoalStatus } from '../enums/goal.enums';
import { PtsReassessmentService } from '../services/pts-reassessment.service';
import {
  accountOf,
  admin,
  member,
  outsider,
  patient,
  responsible,
  seededGoalsRepo,
} from './goal-fixtures';
import { InMemoryPtsReassessmentRepository } from './in-memory-pts-reassessment.repository';
import { expectApiError } from './test-utils';

const body = (
  overrides: Partial<RegisterReassessmentRequestDto> = {},
): RegisterReassessmentRequestDto => ({
  meetingDate: '2026-12-15',
  goals: [
    { goalId: 'goal-1', status: GoalStatus.Achieved },
    {
      goalId: 'goal-2',
      status: GoalStatus.PartiallyAchieved,
      note: '  Conversa 2 vezes por semana.  ',
    },
  ],
  createNextVersion: true,
  ...overrides,
});

describe('PtsReassessmentService (RFEVA005)', () => {
  let goalsRepo: ReturnType<typeof seededGoalsRepo>;
  let repo: InMemoryPtsReassessmentRepository;
  let service: PtsReassessmentService;

  function setup(status = PtsStateEnum.RUNNING) {
    goalsRepo = seededGoalsRepo(status);
    repo = new InMemoryPtsReassessmentRepository();
    service = new PtsReassessmentService(goalsRepo, repo);
  }

  const register = (
    overrides: Partial<RegisterReassessmentRequestDto> = {},
    account = responsible,
    ptsId = 'pts-1',
  ) => service.registerReassessment(ptsId, body(overrides), account);

  beforeEach(() => setup());

  it('o responsável registra e cria a próxima versão', async () => {
    expect(await register({ reason: '  Metas revistas.  ' })).toEqual({
      id: 'pts-1',
      status: 'concluded',
      reassessedAt: '2026-12-15',
      nextPtsId: 'pts-2',
    });
    expect(repo.registered[0]).toEqual({
      ptsId: 'pts-1',
      meetingDate: '2026-12-15',
      goals: [
        { goalId: 'goal-1', status: 'achieved', note: null },
        {
          goalId: 'goal-2',
          status: 'partially_achieved',
          note: 'Conversa 2 vezes por semana.',
        },
      ],
      createNextVersion: true,
      reason: 'Metas revistas.',
      actor: {
        accountId: 'acc-1',
        professionalId: 'prof-1',
        name: 'Ana Souza',
      },
    });
  });

  it('"Encerrar sem novo PTS" não pede a próxima versão', async () => {
    expect(await register({ createNextVersion: false })).toMatchObject({
      nextPtsId: null,
    });
    expect(repo.registered[0]).toMatchObject({
      createNextVersion: false,
      reason: null,
    });
  });

  it('o admin registra sem autor nos eventos (RN022, RN029)', async () => {
    await register({}, admin);

    expect(repo.registered[0].actor).toEqual({
      accountId: 'acc-admin',
      professionalId: null,
      name: 'Kaio',
    });
  });

  it('recusa com meta sem resultado e diz quantas faltam', async () => {
    const one = await expectApiError(
      () =>
        register({
          goals: [{ goalId: 'goal-1', status: GoalStatus.Achieved }],
        }),
      400,
      'GOALS_WITHOUT_RESULT',
    );
    expect(one.message).toBe('Falta 1 meta sem resultado.');

    const two = await expectApiError(
      () => register({ goals: [] }),
      400,
      'GOALS_WITHOUT_RESULT',
    );
    expect(two.message).toBe('Faltam 2 metas sem resultado.');
    expect(repo.registered).toHaveLength(0);
  });

  it('ignora a meta já com resultado e a excluída', async () => {
    goalsRepo.goals[1].status = GoalStatus.NotAchieved;
    goalsRepo.goals.push({
      ...goalsRepo.goals[0],
      id: 'goal-3',
      deleted: true,
    });

    await register({
      goals: [{ goalId: 'goal-1', status: GoalStatus.Achieved }],
    });

    expect(repo.registered).toHaveLength(1);
  });

  it.each([
    ['meta de outro PTS', [{ goalId: 'goal-x', status: GoalStatus.Achieved }]],
    [
      'meta repetida',
      [
        { goalId: 'goal-1', status: GoalStatus.Achieved },
        { goalId: 'goal-1', status: GoalStatus.NotAchieved },
        { goalId: 'goal-2', status: GoalStatus.Achieved },
      ],
    ],
  ])('recusa %s com 400', async (_name, goals) => {
    await expectApiError(
      () =>
        register({ goals: goals as RegisterReassessmentRequestDto['goals'] }),
      400,
      'VALIDATION_ERROR',
    );
    expect(repo.registered).toHaveLength(0);
  });

  it('nega a outro profissional, à equipe, ao paciente e à conta sem perfil', async () => {
    for (const account of [
      member,
      outsider,
      patient,
      accountOf({ accountId: 'x' }),
    ]) {
      await expectApiError(() => register({}, account), 403, 'FORBIDDEN');
    }
  });

  it.each([
    PtsStateEnum.DRAFT,
    PtsStateEnum.PLANNING,
    PtsStateEnum.CONCLUDED,
    PtsStateEnum.CANCELLED,
  ])('recusa o PTS em %s com 409 PTS_NOT_RUNNING', async (status) => {
    setup(status);

    for (const account of [responsible, admin]) {
      await expectApiError(() => register({}, account), 409, 'PTS_NOT_RUNNING');
    }
  });

  it('responde 404 quando o PTS não existe', async () => {
    await expectApiError(
      () => register({}, admin, 'pts-x'),
      404,
      'PTS_NOT_FOUND',
    );
  });
});
