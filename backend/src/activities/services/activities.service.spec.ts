import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import {
  accountOf,
  admin,
  member,
  outsider,
  patient,
  responsible,
  seededGoalsRepo,
} from '../../pts/__tests__/goal-fixtures';
import { expectApiError } from '../../pts/__tests__/test-utils';
import type { CreateActivityRequestDto } from '../dto/create-activity.dto';
import {
  ActivityExecutor,
  ActivityModality,
  VisitPlace,
} from '../enums/activity.enums';
import {
  activityBody,
  InMemoryActivitiesRepository,
} from '../__tests__/activity-fixtures';
import { ActivitiesService } from './activities.service';

describe('ActivitiesService (RFACT001)', () => {
  let repo: InMemoryActivitiesRepository;
  let service: ActivitiesService;

  function setup(status = PtsStateEnum.RUNNING) {
    repo = new InMemoryActivitiesRepository();
    service = new ActivitiesService(repo, seededGoalsRepo(status));
  }

  const create = (
    changes: Partial<CreateActivityRequestDto> = {},
    account = member,
    ptsId = 'pts-1',
  ) =>
    service.createActivity(ptsId, { ...activityBody(), ...changes }, account);

  beforeEach(() => setup());

  describe('createActivity', () => {
    it.each([PtsStateEnum.DRAFT, PtsStateEnum.PLANNING, PtsStateEnum.RUNNING])(
      'cria como suggested (RN012) no PTS em %s',
      async (status) => {
        setup(status);

        expect(await create()).toMatchObject({
          title: 'Integração sensorial',
          status: 'suggested',
          executor: 'team',
          visitPlace: null,
          goalId: null,
        });
        expect(repo.created[0]).toMatchObject({
          ptsId: 'pts-1',
          executorProfessionalIds: [],
          documentIds: [],
          authorProfessionalId: 'prof-2',
          executedByAccountId: 'acc-2',
          description: 'João Lima sugeriu a atividade Integração sensorial',
        });
      },
    );

    it.each([
      undefined,
      null,
      'semanal',
      {},
      { quantity: 0, period: 'weekly', durationMinutes: 45 },
      { quantity: 1.5, period: 'weekly', durationMinutes: 45 },
      { quantity: '1', period: 'weekly', durationMinutes: 45 },
      { quantity: 1, period: 'daily', durationMinutes: 45 },
      { quantity: 1, period: 'weekly', durationMinutes: 0 },
      { quantity: 1, period: 'weekly' },
    ])('recusa a frequência %j com 422, sem criar', async (frequency) => {
      const error = await expectApiError(
        () => create({ frequency } as never),
        422,
        'INVALID_FREQUENCY',
      );

      expect(error.message).toBe(
        'Frequência inválida: informe quantidade, período e duração.',
      );
      expect(repo.created).toHaveLength(0);
    });

    it('guarda só os campos conhecidos da frequência', async () => {
      await create({
        frequency: { ...activityBody().frequency, extra: 1 },
      } as never);

      expect(repo.created[0].values.frequency).toEqual(
        activityBody().frequency,
      );
    });

    it('guarda o local só na visita externa', async () => {
      await create({ visitPlace: VisitPlace.School });
      await create({
        modality: ActivityModality.ExternalVisit,
        visitPlace: VisitPlace.School,
      });

      expect(repo.created.map(({ values }) => values.visitPlace)).toEqual([
        null,
        'school',
      ]);
    });

    it('liga a uma meta do mesmo PTS e recusa a de outro (E04)', async () => {
      await create({ goalId: 'goal-1' });
      expect(repo.created[0].values.goalId).toBe('goal-1');

      await expectApiError(
        () => create({ goalId: 'goal-de-outro-pts' }),
        400,
        'VALIDATION_ERROR',
      );
    });

    it('aceita executores da equipe, sem repetir, e recusa os de fora', async () => {
      await create({ executorProfessionalIds: ['prof-1', 'prof-2', 'prof-1'] });
      expect(repo.created[0].executorProfessionalIds).toEqual([
        'prof-1',
        'prof-2',
      ]);

      await expectApiError(
        () => create({ executorProfessionalIds: ['prof-9'] }),
        400,
        'VALIDATION_ERROR',
      );
    });

    it('recusa profissionais executores quando quem executa não é a equipe', async () => {
      await expectApiError(
        () =>
          create({
            executor: ActivityExecutor.Family,
            executorProfessionalIds: ['prof-1'],
          }),
        400,
        'VALIDATION_ERROR',
      );
      await create({ executor: ActivityExecutor.Family });
      expect(repo.created[0].values.executor).toBe('family');
    });

    it('associa documentos do mesmo paciente e recusa os de outro (RN013)', async () => {
      repo.documents = [
        { id: 'doc-1', patientId: 'patient-1' },
        { id: 'doc-2', patientId: 'patient-2' },
      ];

      await create({ documentIds: ['doc-1', 'doc-1'] });
      expect(repo.created[0].documentIds).toEqual(['doc-1']);

      for (const documentIds of [['doc-1', 'doc-2'], ['doc-x']]) {
        await expectApiError(
          () => create({ documentIds }),
          400,
          'VALIDATION_ERROR',
        );
      }
      expect(repo.created).toHaveLength(1);
    });

    it('segue a autoria da RN029', async () => {
      await create({ authorProfessionalId: 'prof-1' }, member);
      await create({}, admin);
      await create({ authorProfessionalId: 'prof-1' }, admin);

      expect(
        repo.created.map(({ authorProfessionalId }) => authorProfessionalId),
      ).toEqual(['prof-2', null, 'prof-1']);
      await expectApiError(
        () => create({ authorProfessionalId: 'prof-9' }, admin),
        400,
        'VALIDATION_ERROR',
      );
    });

    it('nega a quem não é da equipe', async () => {
      for (const account of [outsider, patient, accountOf()]) {
        await expectApiError(() => create({}, account), 403, 'FORBIDDEN');
      }
    });

    it.each([
      PtsStateEnum.CONCLUDED,
      PtsStateEnum.CANCELLED,
      PtsStateEnum.REJECTED,
    ])('recusa o PTS em %s, até para o admin', async (status) => {
      setup(status);

      for (const account of [member, admin]) {
        await expectApiError(
          () => create({}, account),
          409,
          'PTS_NOT_EDITABLE',
        );
      }
    });

    it('responde 404 quando o PTS não existe', async () => {
      await expectApiError(
        () => create({}, member, 'pts-x'),
        404,
        'PTS_NOT_FOUND',
      );
    });
  });

  describe('findActivities', () => {
    it('lista para a equipe, o paciente titular (RN028) e o admin', async () => {
      await create();

      for (const account of [responsible, member, patient, admin]) {
        expect(
          (await service.findActivities('pts-1', account)).data,
        ).toHaveLength(1);
      }
    });

    it('não mostra os documentos ao paciente (RN028)', async () => {
      repo.documents = [{ id: 'doc-1', patientId: 'patient-1' }];
      await create({ documentIds: ['doc-1'] });

      const [seenByPatient] = (await service.findActivities('pts-1', patient))
        .data;
      const [seenByTeam] = (await service.findActivities('pts-1', member)).data;

      expect(seenByPatient.documentIds).toEqual([]);
      expect(seenByTeam.documentIds).toEqual(['doc-1']);
    });

    it('nega a quem não tem vínculo e à equipe do PTS rejeitado (RN016)', async () => {
      await expectApiError(
        () => service.findActivities('pts-1', outsider),
        403,
        'FORBIDDEN',
      );
      setup(PtsStateEnum.REJECTED);
      await expectApiError(
        () => service.findActivities('pts-1', member),
        403,
        'FORBIDDEN',
      );
    });

    it('responde 404 quando o PTS não existe', async () => {
      await expectApiError(
        () => service.findActivities('pts-x', admin),
        404,
        'PTS_NOT_FOUND',
      );
    });
  });
});
