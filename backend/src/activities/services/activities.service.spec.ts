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
import type { GetActivitiesQueryDto } from '../dto/get-activities-query.dto';
import type { UpdateActivityRequestDto } from '../dto/update-activity.dto';
import {
  ActivityExecutor,
  ActivityModality,
  ActivityPeriod,
  ActivityState,
  VisitPlace,
} from '../enums/activity.enums';
import type { StoredActivity } from '../repositories/activities.repository';
import {
  activityBody,
  InMemoryActivitiesRepository,
  storedActivity,
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
  const query = (
    changes: Partial<GetActivitiesQueryDto> = {},
  ): GetActivitiesQueryDto => ({ page: 1, limit: 20, ...changes });

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
          (await service.findActivities('pts-1', query(), account)).data,
        ).toHaveLength(1);
      }
    });

    it('não mostra os documentos ao paciente (RN028)', async () => {
      repo.documents = [{ id: 'doc-1', patientId: 'patient-1' }];
      await create({ documentIds: ['doc-1'] });

      const [seenByPatient] = (
        await service.findActivities('pts-1', query(), patient)
      ).data;
      const [seenByTeam] = (
        await service.findActivities('pts-1', query(), member)
      ).data;

      expect(seenByPatient.documentIds).toEqual([]);
      expect(seenByTeam.documentIds).toEqual(['doc-1']);
    });

    it('nega a quem não tem vínculo e à equipe do PTS rejeitado (RN016)', async () => {
      const forbidden = await expectApiError(
        () => service.findActivities('pts-1', query(), outsider),
        403,
        'FORBIDDEN',
      );
      expect(forbidden.message).toBe(
        'Você não tem acesso às atividades deste PTS.',
      );
      setup(PtsStateEnum.REJECTED);
      await expectApiError(
        () => service.findActivities('pts-1', query(), member),
        403,
        'FORBIDDEN',
      );
    });

    it('responde 404 quando o PTS não existe', async () => {
      await expectApiError(
        () => service.findActivities('pts-x', query(), admin),
        404,
        'PTS_NOT_FOUND',
      );
    });

    it('aplica filtros e paginação e devolve o total', async () => {
      await create();
      await create({ title: 'Atividade suspensa' });

      const result = await service.findActivities(
        'pts-1',
        query({ status: [ActivityState.Suggested], page: 2, limit: 1 }),
        member,
      );

      expect(result).toMatchObject({
        data: [{ title: 'Atividade suspensa' }],
        pagination: { page: 2, limit: 1, total: 2, totalPages: 2 },
      });
    });

    it('retorna o detalhe autorizado e não revela documentos ao paciente', async () => {
      repo.documents = [{ id: 'doc-1', patientId: 'patient-1' }];
      const created = await create({
        documentIds: ['doc-1'],
        goalId: 'goal-1',
      });

      await expect(
        service.findActivityById(created.id, member),
      ).resolves.toMatchObject({
        goal: { id: 'goal-1', title: 'Meta terapêutica' },
        documents: [{ id: 'doc-1', title: 'Documento doc-1' }],
        appointmentsCount: 0,
      });
      await expect(
        service.findActivityById(created.id, patient),
      ).resolves.toMatchObject({ documents: [], documentIds: [] });
    });

    it('responde ACTIVITY_NOT_FOUND para atividade inexistente', async () => {
      await expectApiError(
        () => service.findActivityById('act-x', admin),
        404,
        'ACTIVITY_NOT_FOUND',
      );
    });
  });
});

describe('ActivitiesService.updateActivity (RFACT005)', () => {
  let repo: InMemoryActivitiesRepository;
  let service: ActivitiesService;

  function setup(
    activity: Partial<StoredActivity> = {},
    status = PtsStateEnum.RUNNING,
  ) {
    repo = new InMemoryActivitiesRepository();
    repo.activities.push(storedActivity(activity));
    service = new ActivitiesService(repo, seededGoalsRepo(status));
  }

  const update = (
    changes: Partial<UpdateActivityRequestDto> = { title: 'Novo título' },
    account = member,
    activityId = 'act-1',
  ) =>
    service.updateActivity(
      activityId,
      changes as UpdateActivityRequestDto,
      account,
    );

  beforeEach(() => setup());

  it('o autor edita a sugerida e só muda o que foi enviado', async () => {
    const frequency = {
      quantity: 2,
      period: ActivityPeriod.Biweekly,
      durationMinutes: 30,
    };

    const updated = await update({ title: 'Circuito sensorial', frequency });

    expect(updated).toMatchObject({
      title: 'Circuito sensorial',
      description: activityBody().description,
      type: activityBody().type,
      frequency,
      status: 'suggested',
      updatedAt: '2026-12-02T13:00:00.000Z',
    });
    expect(repo.updated[0]).toMatchObject({
      ptsId: 'pts-1',
      activityId: 'act-1',
      allowedStates: ['suggested'],
      authorProfessionalId: 'prof-2',
      executedByAccountId: 'acc-2',
      description: 'João Lima atualizou a atividade Circuito sensorial',
      goalUnlinkedDescription:
        'João Lima desligou a atividade Circuito sensorial da meta',
    });
    expect(repo.updated[0].documentIds).toBeUndefined();
  });

  it.each([ActivityState.Suggested, ActivityState.Running])(
    'o responsável do PTS edita a atividade %s',
    async (status) => {
      setup({ status });

      await update(undefined, responsible);

      expect(repo.updated).toHaveLength(1);
      expect(repo.updated[0].allowedStates).toEqual(['suggested', 'running']);
    },
  );

  it('nega ao autor a atividade em andamento e a quem não é autor nem responsável', async () => {
    setup({ status: ActivityState.Running });
    await expectApiError(() => update(), 403, 'FORBIDDEN');

    setup({ authorProfessionalId: 'prof-1' });
    for (const account of [member, outsider, patient, accountOf()]) {
      await expectApiError(() => update(undefined, account), 403, 'FORBIDDEN');
    }
    expect(repo.updated).toHaveLength(0);
  });

  it.each([
    ActivityState.Suggested,
    ActivityState.Running,
    ActivityState.Suspended,
    ActivityState.Concluded,
  ])(
    'o admin edita a atividade %s (RN022), sem autor no evento',
    async (status) => {
      setup({ status });

      await update(undefined, admin);

      expect(repo.updated[0]).toMatchObject({
        authorProfessionalId: null,
        executedByAccountId: 'acc-admin',
        description: 'Kaio atualizou a atividade Novo título',
      });
    },
  );

  it.each([ActivityState.Rejected, ActivityState.Archived])(
    'recusa a atividade %s com 409, até para o admin',
    async (status) => {
      setup({ status });

      for (const account of [member, responsible, admin]) {
        const error = await expectApiError(
          () => update(undefined, account),
          409,
          'ACTIVITY_NOT_EDITABLE',
        );
        expect(error.message).toBe(
          'Atividade rejeitada ou arquivada não pode ser editada.',
        );
      }
      expect(repo.updated).toHaveLength(0);
    },
  );

  it('responde 404 quando a atividade não existe', async () => {
    await expectApiError(
      () => update(undefined, admin, 'act-x'),
      404,
      'ACTIVITY_NOT_FOUND',
    );
  });

  it('recusa com o PTS encerrado, até para o admin', async () => {
    setup({}, PtsStateEnum.CONCLUDED);

    for (const account of [member, admin]) {
      await expectApiError(
        () => update(undefined, account),
        409,
        'PTS_NOT_EDITABLE',
      );
    }
  });

  it('exige ao menos um campo', async () => {
    await expectApiError(
      () => update({ title: undefined }),
      400,
      'VALIDATION_ERROR',
    );
  });

  it.each([
    null,
    { quantity: 0, period: 'weekly', durationMinutes: 45 },
    { quantity: 1, period: 'daily', durationMinutes: 45 },
  ])('recusa a frequência %j com 422, sem salvar', async (frequency) => {
    await expectApiError(
      () => update({ frequency } as never),
      422,
      'INVALID_FREQUENCY',
    );
    expect(repo.updated).toHaveLength(0);
  });

  it('guarda o local só na visita externa', async () => {
    await expectApiError(
      () => update({ modality: ActivityModality.ExternalVisit }),
      400,
      'VALIDATION_ERROR',
    );

    await update({
      modality: ActivityModality.ExternalVisit,
      visitPlace: VisitPlace.School,
    });
    await update({ title: 'Mantém a visita' });
    await update({ modality: ActivityModality.InPerson });

    expect(repo.updated.map(({ values }) => values.visitPlace)).toEqual([
      'school',
      'school',
      null,
    ]);
  });

  it('troca a meta por outra do mesmo PTS e desliga com null', async () => {
    setup({ goalId: 'goal-1' });

    await expectApiError(
      () => update({ goalId: 'goal-de-outro-pts' }),
      400,
      'VALIDATION_ERROR',
    );
    await update({ title: 'Mantém a meta' });
    await update({ goalId: 'goal-2' });
    await update({ goalId: null });

    expect(repo.updated.map(({ values }) => values.goalId)).toEqual([
      'goal-1',
      'goal-2',
      null,
    ]);
  });

  it('troca os documentos por outros do mesmo paciente (RN013)', async () => {
    repo.documents = [
      { id: 'doc-1', patientId: 'patient-1' },
      { id: 'doc-2', patientId: 'patient-2' },
    ];

    await expectApiError(
      () => update({ documentIds: ['doc-1', 'doc-2'] }),
      400,
      'VALIDATION_ERROR',
    );
    await update({ documentIds: ['doc-1', 'doc-1'] });
    await update({ documentIds: [] });

    expect(repo.updated.map(({ documentIds }) => documentIds)).toEqual([
      ['doc-1'],
      [],
    ]);
  });
});

describe('ActivitiesService.archiveActivity (RFACT008)', () => {
  let repo: InMemoryActivitiesRepository;
  let service: ActivitiesService;

  function setup(
    activity: Partial<StoredActivity> = {},
    status = PtsStateEnum.RUNNING,
  ) {
    repo = new InMemoryActivitiesRepository();
    repo.activities.push(storedActivity(activity));
    service = new ActivitiesService(repo, seededGoalsRepo(status));
  }

  const archive = (reason?: string, account = member, activityId = 'act-1') =>
    service.archiveActivity(activityId, { reason }, account);

  beforeEach(() => setup());

  it.each([
    ActivityState.Suggested,
    ActivityState.Running,
    ActivityState.Suspended,
  ])('a equipe arquiva a atividade %s com o motivo', async (status) => {
    setup({ status });

    expect(await archive('  Família assumiu a atividade em casa.  ')).toEqual({
      id: 'act-1',
      status: 'archived',
      archivedAt: '2026-12-06T12:00:00.000Z',
    });
    expect(repo.archived[0]).toEqual({
      ptsId: 'pts-1',
      activityId: 'act-1',
      reason: 'Família assumiu a atividade em casa.',
      authorProfessionalId: 'prof-2',
      executedByAccountId: 'acc-2',
      description:
        'João Lima arquivou a atividade Integração sensorial (Família assumiu a atividade em casa.)',
    });
  });

  it('arquiva sem motivo, e qualquer membro da equipe pode', async () => {
    setup({ authorProfessionalId: 'prof-1' });

    await archive('   ');

    expect(repo.archived[0]).toMatchObject({
      reason: null,
      description: 'João Lima arquivou a atividade Integração sensorial',
    });
  });

  it('o admin arquiva sem autor no evento (RN022)', async () => {
    await archive(undefined, admin);

    expect(repo.archived[0]).toMatchObject({
      authorProfessionalId: null,
      executedByAccountId: 'acc-admin',
      description: 'Kaio arquivou a atividade Integração sensorial',
    });
  });

  it.each([
    ActivityState.Rejected,
    ActivityState.Concluded,
    ActivityState.Archived,
  ])('recusa a atividade %s com 409, até para o admin', async (status) => {
    setup({ status });

    for (const account of [member, admin]) {
      const error = await expectApiError(
        () => archive(undefined, account),
        409,
        'ACTIVITY_NOT_ARCHIVABLE',
      );
      expect(error.message).toBe(
        'Atividade rejeitada, concluída ou já arquivada não pode ser arquivada.',
      );
    }
    expect(repo.archived).toHaveLength(0);
  });

  it('nega a quem não é da equipe', async () => {
    for (const account of [outsider, patient, accountOf()]) {
      await expectApiError(() => archive(undefined, account), 403, 'FORBIDDEN');
    }
    expect(repo.archived).toHaveLength(0);
  });

  it('responde 404 quando a atividade não existe', async () => {
    await expectApiError(
      () => archive(undefined, admin, 'act-x'),
      404,
      'ACTIVITY_NOT_FOUND',
    );
  });

  it('recusa com o PTS encerrado', async () => {
    setup({}, PtsStateEnum.CONCLUDED);

    await expectApiError(() => archive(), 409, 'PTS_NOT_EDITABLE');
  });
});

describe('ActivitiesService.changeActivityStatus (RFACT009)', () => {
  let repo: InMemoryActivitiesRepository;
  let service: ActivitiesService;

  function setup(status: ActivityState, ptsStatus = PtsStateEnum.RUNNING) {
    repo = new InMemoryActivitiesRepository();
    repo.activities.push(storedActivity({ status }));
    service = new ActivitiesService(repo, seededGoalsRepo(ptsStatus));
  }

  const ALLOWED = [
    ['suspend', ActivityState.Running, 'suspended', 'suspendeu'],
    ['resume', ActivityState.Suspended, 'running', 'retomou'],
    ['conclude', ActivityState.Running, 'concluded', 'concluiu'],
    ['conclude', ActivityState.Suspended, 'concluded', 'concluiu'],
  ] as const;

  it.each(ALLOWED)(
    '%s: de %s para %s, com data e evento',
    async (action, from, to, verb) => {
      setup(from);

      expect(
        await service.changeActivityStatus('act-1', action, {}, member),
      ).toEqual({
        id: 'act-1',
        status: to,
        changedAt: '2026-12-07T12:00:00.000Z',
      });
      expect(repo.statusChanges).toEqual([
        {
          ptsId: 'pts-1',
          activityId: 'act-1',
          action,
          reason: null,
          authorProfessionalId: 'prof-2',
          executedByAccountId: 'acc-2',
          description: `João Lima ${verb} a atividade Integração sensorial`,
        },
      ]);
    },
  );

  it.each(['suspend', 'resume', 'conclude'] as const)(
    '%s: recusa os outros estados, até para o admin',
    async (action) => {
      const allowed = ALLOWED.filter(([name]) => name === action).map(
        ([, from]) => from as ActivityState,
      );

      for (const status of Object.values(ActivityState)) {
        if (allowed.includes(status)) {
          continue;
        }

        setup(status);
        for (const account of [member, admin]) {
          const error = await expectApiError(
            () => service.changeActivityStatus('act-1', action, {}, account),
            409,
            'INVALID_ACTIVITY_TRANSITION',
          );
          expect(error.message).toBe(
            'A atividade não está em um estado que permita esta ação.',
          );
        }
        expect(repo.activities[0].status).toBe(status);
      }
    },
  );

  it('na suspensão, grava o motivo aparado e o põe no evento', async () => {
    setup(ActivityState.Running);

    await service.changeActivityStatus(
      'act-1',
      'suspend',
      { reason: '  reforma da sala ' },
      responsible,
    );

    expect(repo.statusChanges[0]).toMatchObject({
      reason: 'reforma da sala',
      description:
        'Ana Souza suspendeu a atividade Integração sensorial (reforma da sala)',
    });
  });

  it('o admin muda sem profissional atribuído (RN029)', async () => {
    setup(ActivityState.Running);

    await service.changeActivityStatus('act-1', 'conclude', {}, admin);

    expect(repo.statusChanges[0]).toMatchObject({
      authorProfessionalId: null,
      executedByAccountId: 'acc-admin',
    });
  });

  it('nega a quem é de fora e ao paciente', async () => {
    setup(ActivityState.Running);

    for (const account of [outsider, patient]) {
      await expectApiError(
        () => service.changeActivityStatus('act-1', 'suspend', {}, account),
        403,
        'FORBIDDEN',
      );
    }
    expect(repo.statusChanges).toHaveLength(0);
  });

  it('responde 404 e, com o PTS encerrado, 409 PTS_NOT_EDITABLE', async () => {
    setup(ActivityState.Running, PtsStateEnum.CONCLUDED);

    await expectApiError(
      () => service.changeActivityStatus('act-x', 'suspend', {}, member),
      404,
      'ACTIVITY_NOT_FOUND',
    );
    await expectApiError(
      () => service.changeActivityStatus('act-1', 'suspend', {}, member),
      409,
      'PTS_NOT_EDITABLE',
    );
  });
});

describe('ActivitiesService.decideActivity (RFACT003)', () => {
  let repo: InMemoryActivitiesRepository;
  let service: ActivitiesService;

  function setup(
    status = ActivityState.Suggested,
    ptsStatus = PtsStateEnum.RUNNING,
  ) {
    repo = new InMemoryActivitiesRepository();
    repo.activities.push(storedActivity({ status }));
    service = new ActivitiesService(repo, seededGoalsRepo(ptsStatus));
  }

  beforeEach(() => setup());

  it('a equipe aprova a sugerida, que entra em execução', async () => {
    expect(
      await service.decideActivity(
        'act-1',
        'approve',
        { reason: 'ignorado' },
        responsible,
      ),
    ).toEqual({
      id: 'act-1',
      status: 'running',
      decidedAt: '2026-12-02T12:00:00.000Z',
    });
    expect(repo.decisions).toEqual([
      {
        ptsId: 'pts-1',
        activityId: 'act-1',
        decision: 'approve',
        reason: null,
        authorProfessionalId: 'prof-1',
        executedByAccountId: 'acc-1',
        description: 'Ana Souza aprovou a atividade Integração sensorial',
      },
    ]);
  });

  it('o autor rejeita a própria sugestão com o motivo aparado', async () => {
    expect(
      await service.decideActivity(
        'act-1',
        'reject',
        { reason: '  Já existe atividade equivalente.  ' },
        member,
      ),
    ).toMatchObject({ status: 'rejected' });
    expect(repo.decisions[0]).toMatchObject({
      decision: 'reject',
      reason: 'Já existe atividade equivalente.',
      authorProfessionalId: 'prof-2',
      description:
        'João Lima rejeitou a atividade Integração sensorial (Já existe atividade equivalente.)',
    });
  });

  it('rejeita sem motivo, e o admin decide sem autor no evento (RN029)', async () => {
    await service.decideActivity('act-1', 'reject', { reason: '  ' }, admin);

    expect(repo.decisions[0]).toMatchObject({
      reason: null,
      authorProfessionalId: null,
      executedByAccountId: 'acc-admin',
      description: 'Kaio rejeitou a atividade Integração sensorial',
    });
  });

  it.each(['approve', 'reject'] as const)(
    '%s: recusa a atividade fora de suggested com 409, até para o admin',
    async (decision) => {
      for (const status of Object.values(ActivityState)) {
        if (status === ActivityState.Suggested) {
          continue;
        }

        setup(status);

        const error = await expectApiError(
          () => service.decideActivity('act-1', decision, {}, admin),
          409,
          'ACTIVITY_NOT_SUGGESTED',
        );
        expect(error.message).toBe('Só uma atividade sugerida recebe decisão.');
      }
      expect(repo.decisions).toHaveLength(0);
    },
  );

  it('nega a quem é de fora da equipe e ao paciente', async () => {
    for (const account of [outsider, patient, accountOf()]) {
      await expectApiError(
        () => service.decideActivity('act-1', 'approve', {}, account),
        403,
        'FORBIDDEN',
      );
    }
    expect(repo.decisions).toHaveLength(0);
  });

  it('responde 404 e, com o PTS encerrado, 409 PTS_NOT_EDITABLE', async () => {
    await expectApiError(
      () => service.decideActivity('act-x', 'approve', {}, admin),
      404,
      'ACTIVITY_NOT_FOUND',
    );

    setup(ActivityState.Suggested, PtsStateEnum.CONCLUDED);
    await expectApiError(
      () => service.decideActivity('act-1', 'reject', {}, member),
      409,
      'PTS_NOT_EDITABLE',
    );
  });
});
