import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import { GoalOrigin, GoalStatus } from '../enums/goal.enums';
import { PtsGoalsService } from '../services/pts-goals.service';
import {
  accountOf,
  admin,
  goalBody,
  member,
  outsider,
  patient,
  responsible,
  seededGoalsRepo,
  storedGoal,
} from './goal-fixtures';
import type { InMemoryPtsGoalsRepository } from './in-memory-pts-goals.repository';
import { expectApiError } from './test-utils';

const CLOSED = [
  PtsStateEnum.CONCLUDED,
  PtsStateEnum.CANCELLED,
  PtsStateEnum.REJECTED,
];
const EDITABLE = [
  PtsStateEnum.DRAFT,
  PtsStateEnum.PLANNING,
  PtsStateEnum.RUNNING,
];

describe('PtsGoalsService (RFPTS012)', () => {
  let repo: InMemoryPtsGoalsRepository;
  let service: PtsGoalsService;

  function setup(status = PtsStateEnum.RUNNING) {
    repo = seededGoalsRepo(status);
    service = new PtsGoalsService(repo);
  }

  beforeEach(() => setup());

  describe('findGoals', () => {
    it.each([
      ['responsável', responsible],
      ['membro', member],
      ['paciente titular', patient],
      ['admin', admin],
    ])('lista as metas para %s', async (_name, account) => {
      const { data } = await service.findGoals('pts-1', account);

      expect(data.map((goal) => goal.id)).toEqual(['goal-1', 'goal-2']);
    });

    it.each([PtsStateEnum.CONCLUDED, PtsStateEnum.CANCELLED])(
      'a equipe ainda vê as metas do PTS em %s',
      async (status) => {
        setup(status);

        expect((await service.findGoals('pts-1', member)).data).toHaveLength(2);
      },
    );

    it('o PTS rejeitado não abre para a equipe (RN016), só para o paciente e o admin', async () => {
      setup(PtsStateEnum.REJECTED);

      await expectApiError(
        () => service.findGoals('pts-1', member),
        403,
        'FORBIDDEN',
      );
      for (const account of [patient, admin]) {
        expect((await service.findGoals('pts-1', account)).data).toHaveLength(
          2,
        );
      }
    });

    it.each([
      ['profissional de fora', outsider],
      ['outro paciente', accountOf({ patientProfileId: 'patient-2' })],
      ['conta sem perfil', accountOf()],
    ])('nega a %s', async (_name, account) => {
      await expectApiError(
        () => service.findGoals('pts-1', account),
        403,
        'FORBIDDEN',
      );
    });

    it('responde 404 quando o PTS não existe', async () => {
      await expectApiError(
        () => service.findGoals('pts-x', admin),
        404,
        'PTS_NOT_FOUND',
      );
    });
  });

  describe('createGoal', () => {
    it.each(EDITABLE)('cadastra no PTS em %s', async (status) => {
      setup(status);

      const goal = await service.createGoal('pts-1', goalBody(), member);

      expect(goal).toMatchObject({
        ...goalBody(),
        status: GoalStatus.InProgress,
        origin: GoalOrigin.New,
        activitiesCount: 0,
      });
      expect(repo.created[0]).toMatchObject({
        authorProfessionalId: 'prof-2',
        executedByAccountId: 'acc-2',
        description: 'João Lima adicionou a meta Conversa curta com um colega',
      });
    });

    it('o profissional não atribui a autoria a outro (RN029)', async () => {
      await service.createGoal(
        'pts-1',
        { ...goalBody(), authorProfessionalId: 'prof-1' },
        member,
      );

      expect(repo.created[0].authorProfessionalId).toBe('prof-2');
      expect(repo.created[0].values).not.toHaveProperty('authorProfessionalId');
    });

    it('a autoria fica com a conta do admin quando ele não atribui', async () => {
      await service.createGoal('pts-1', goalBody(), admin);

      expect(repo.created[0]).toMatchObject({
        authorProfessionalId: null,
        executedByAccountId: 'acc-admin',
      });
    });

    it('o admin atribui a autoria a um profissional da equipe', async () => {
      await service.createGoal(
        'pts-1',
        { ...goalBody(), authorProfessionalId: 'prof-2' },
        admin,
      );

      expect(repo.created[0]).toMatchObject({
        authorProfessionalId: 'prof-2',
        executedByAccountId: 'acc-admin',
      });
    });

    it('recusa autor fora da equipe', async () => {
      await expectApiError(
        () =>
          service.createGoal(
            'pts-1',
            { ...goalBody(), authorProfessionalId: 'prof-9' },
            admin,
          ),
        400,
        'VALIDATION_ERROR',
      );
    });

    it('aceita a data-alvo no dia da próxima revisão e recusa depois', async () => {
      await service.createGoal(
        'pts-1',
        { ...goalBody(), targetDate: '2027-03-31' },
        member,
      );
      await expectApiError(
        () =>
          service.createGoal(
            'pts-1',
            { ...goalBody(), targetDate: '2027-04-01' },
            member,
          ),
        400,
        'VALIDATION_ERROR',
      );
      expect(repo.created).toHaveLength(1);
    });
  });

  describe('updateGoal', () => {
    it('edita só os campos enviados, com evento', async () => {
      const goal = await service.updateGoal(
        'pts-1',
        'goal-1',
        { title: 'Novo título' },
        member,
      );

      expect(goal.title).toBe('Novo título');
      expect(repo.updated[0]).toEqual({
        ptsId: 'pts-1',
        goalId: 'goal-1',
        changes: { title: 'Novo título' },
        authorProfessionalId: 'prof-2',
        executedByAccountId: 'acc-2',
        description: 'João Lima atualizou a meta Novo título',
      });
    });

    it('cita o título atual quando ele não muda; o admin fica sem autor', async () => {
      await service.updateGoal(
        'pts-1',
        'goal-1',
        { targetDate: '2027-01-10' },
        admin,
      );

      expect(repo.updated[0]).toMatchObject({
        authorProfessionalId: null,
        description: 'Kaio atualizou a meta Conversa curta com um colega',
      });
    });

    it('recusa corpo vazio e data-alvo depois da próxima revisão', async () => {
      for (const body of [{}, { targetDate: '2027-04-01' }]) {
        await expectApiError(
          () => service.updateGoal('pts-1', 'goal-1', body, member),
          400,
          'VALIDATION_ERROR',
        );
      }
      expect(repo.updated).toHaveLength(0);
    });

    it('responde 404 GOAL_NOT_FOUND para meta inexistente ou excluída', async () => {
      repo.goals[0].deleted = true;

      for (const id of ['goal-1', 'goal-x']) {
        await expectApiError(
          () => service.updateGoal('pts-1', id, { title: 'A' }, member),
          404,
          'GOAL_NOT_FOUND',
        );
      }
    });
  });

  describe('removeGoal', () => {
    it('exclui com evento, e a meta some da lista', async () => {
      const result = await service.removeGoal('pts-1', 'goal-1', responsible);

      expect(result).toEqual({ status: 'OK' });
      expect(repo.removed[0]).toEqual({
        ptsId: 'pts-1',
        goalId: 'goal-1',
        authorProfessionalId: 'prof-1',
        executedByAccountId: 'acc-1',
        description: 'Ana Souza excluiu a meta Conversa curta com um colega',
      });
      expect(
        (await service.findGoals('pts-1', member)).data.map((goal) => goal.id),
      ).toEqual(['goal-2']);
    });

    it('recusa a última meta, sem contar as excluídas', async () => {
      repo.goals[1].deleted = true;

      const error = await expectApiError(
        () => service.removeGoal('pts-1', 'goal-1', member),
        409,
        'LAST_GOAL',
      );
      expect(error.message).toBe('O PTS precisa ter ao menos uma meta.');
      expect(repo.removed).toHaveLength(0);
    });

    it('recusa a meta ligada a atividades', async () => {
      repo.goals.push(storedGoal('goal-3', 2));

      await expectApiError(
        () => service.removeGoal('pts-1', 'goal-3', member),
        409,
        'GOAL_HAS_ACTIVITIES',
      );
      expect(repo.removed).toHaveLength(0);
    });

    it('responde 404 GOAL_NOT_FOUND', async () => {
      await expectApiError(
        () => service.removeGoal('pts-1', 'goal-x', member),
        404,
        'GOAL_NOT_FOUND',
      );
    });
  });

  describe.each([
    [
      'createGoal',
      (id: string, account = member): Promise<unknown> =>
        service.createGoal(id, goalBody(), account),
    ],
    [
      'updateGoal',
      (id: string, account = member): Promise<unknown> =>
        service.updateGoal(id, 'goal-1', { title: 'A' }, account),
    ],
    [
      'removeGoal',
      (id: string, account = member): Promise<unknown> =>
        service.removeGoal(id, 'goal-1', account),
    ],
  ])('%s: acesso e estado', (_name, run) => {
    it('nega ao profissional de fora e ao paciente', async () => {
      for (const account of [outsider, patient]) {
        await expectApiError(() => run('pts-1', account), 403, 'FORBIDDEN');
      }
    });

    it.each(CLOSED)('recusa o PTS em %s, até para o admin', async (status) => {
      setup(status);

      for (const account of [member, admin]) {
        await expectApiError(
          () => run('pts-1', account),
          409,
          'PTS_NOT_EDITABLE',
        );
      }
    });

    it('responde 404 quando o PTS não existe', async () => {
      await expectApiError(() => run('pts-x'), 404, 'PTS_NOT_FOUND');
    });
  });
});
