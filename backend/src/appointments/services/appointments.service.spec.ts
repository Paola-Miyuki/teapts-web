import {
  InMemoryActivitiesRepository,
  storedActivity,
} from '../../activities/__tests__/activity-fixtures';
import {
  ActivityExecutor,
  ActivityModality,
  ActivityState,
  VisitPlace,
} from '../../activities/enums/activity.enums';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import {
  admin,
  member,
  outsider,
  patient,
  responsible,
  seededGoalsRepo,
} from '../../pts/__tests__/goal-fixtures';
import { expectApiError } from '../../pts/__tests__/test-utils';
import {
  absenceBody,
  appointmentBody,
  InMemoryAppointmentsRepository,
} from '../__tests__/appointment-fixtures';
import { Attendance } from '../enums/attendance.enum';
import { AppointmentsService } from './appointments.service';

describe('AppointmentsService.createAppointment (RFACT004)', () => {
  let repo: InMemoryAppointmentsRepository;
  let service: AppointmentsService;

  function setup(
    activity: Parameters<typeof storedActivity>[0] = {},
    ptsStatus = PtsStateEnum.RUNNING,
  ) {
    repo = new InMemoryAppointmentsRepository();
    const activities = new InMemoryActivitiesRepository();
    activities.activities.push(
      storedActivity({ status: ActivityState.Running, ...activity }),
    );
    service = new AppointmentsService(
      repo,
      activities,
      seededGoalsRepo(ptsStatus),
    );
  }

  const create = (
    body = appointmentBody(),
    account = member,
    activityId = 'act-1',
    now = new Date('2026-11-25T15:00:00.000Z'),
  ) => service.createAppointment(activityId, body, account, now);

  beforeEach(() => setup());

  it('membro registra o realizado, com autoria e o texto do evento', async () => {
    expect(await create()).toEqual({
      id: '2b1a0f9e-8d7c-4b6a-9e5d-4c3b2a190807',
      activityId: 'act-1',
      attendance: 'done',
      appointmentDate: '2026-11-03',
      createdAt: '2026-11-03T17:50:00.000Z',
    });
    expect(repo.created).toEqual([
      {
        ptsId: 'pts-1',
        activityId: 'act-1',
        values: {
          appointmentDate: '2026-11-03',
          startTime: '14:00',
          endTime: '14:45',
          modality: 'in_person',
          visitPlace: null,
          attendance: 'done',
          soapSubjective: appointmentBody().soapSubjective,
          soapObjective: appointmentBody().soapObjective,
          soapAssessment: appointmentBody().soapAssessment,
          soapPlan: appointmentBody().soapPlan,
          absenceReason: null,
        },
        authorProfessionalId: 'prof-2',
        executedByAccountId: 'acc-2',
        description:
          'João Lima registrou um atendimento da atividade Integração sensorial',
      },
    ]);
  });

  it.each([ActivityExecutor.Family, ActivityExecutor.School])(
    'a atividade executada por %s também recebe atendimento',
    async (executor) => {
      setup({ executor });

      await create();
      expect(repo.created).toHaveLength(1);
    },
  );

  it.each([Attendance.Missed, Attendance.Cancelled])(
    '%s não exige SOAP e guarda o motivo opcional',
    async (attendance) => {
      await create(absenceBody({ attendance, absenceReason: ' Chuva forte ' }));
      await create(absenceBody({ attendance }));

      expect(repo.created[0].values).toMatchObject({
        attendance,
        endTime: null,
        soapSubjective: null,
        soapObjective: null,
        soapAssessment: null,
        soapPlan: null,
        absenceReason: 'Chuva forte',
      });
      expect(repo.created[1].values.absenceReason).toBeNull();
    },
  );

  it.each([
    'soapSubjective',
    'soapObjective',
    'soapAssessment',
    'soapPlan',
    'endTime',
  ] as const)('recusa o realizado sem %s', async (field) => {
    for (const value of [undefined, '   ']) {
      await expectApiError(
        () => create(appointmentBody({ [field]: value })),
        400,
        'VALIDATION_ERROR',
      );
    }
    expect(repo.created).toHaveLength(0);
  });

  it('recusa SOAP na falta e na desmarcação', async () => {
    await expectApiError(
      () => create(absenceBody({ soapPlan: 'Plano' })),
      400,
      'VALIDATION_ERROR',
    );
  });

  it.each(['14:00', '13:59'])(
    'no realizado, recusa o término às %s com início às 14:00',
    async (endTime) => {
      const error = await expectApiError(
        () => create(appointmentBody({ endTime })),
        400,
        'VALIDATION_ERROR',
      );
      expect(error.message).toBe(
        'A hora de término precisa ser depois da hora de início.',
      );
    },
  );

  it('realizado e falta não ficam no futuro; a desmarcação pode', async () => {
    const appointmentDate = '2026-11-26';

    for (const body of [
      appointmentBody({ appointmentDate }),
      absenceBody({ appointmentDate }),
    ]) {
      const error = await expectApiError(
        () => create(body),
        400,
        'VALIDATION_ERROR',
      );
      expect(error.message).toBe(
        'Atendimento realizado ou falta não pode ter data futura.',
      );
    }

    await create(
      absenceBody({ appointmentDate, attendance: Attendance.Cancelled }),
    );
    expect(repo.created).toHaveLength(1);
  });

  it('o dia de hoje é o de Brasília', async () => {
    // 26/11 à 1h em UTC ainda é dia 25 em Brasília.
    const now = new Date('2026-11-26T01:00:00.000Z');
    const on = (appointmentDate: string) =>
      create(appointmentBody({ appointmentDate }), member, 'act-1', now);

    await on('2026-11-25');
    await expectApiError(() => on('2026-11-26'), 400, 'VALIDATION_ERROR');
  });

  it('não guarda motivo de falta no realizado', async () => {
    await create(appointmentBody({ absenceReason: 'Não se aplica' }));

    expect(repo.created[0].values.absenceReason).toBeNull();
  });

  it('guarda o local só na visita externa, onde é obrigatório', async () => {
    await create(appointmentBody({ visitPlace: VisitPlace.School }));
    await create(
      appointmentBody({
        modality: ActivityModality.ExternalVisit,
        visitPlace: VisitPlace.School,
      }),
    );

    expect(repo.created.map(({ values }) => values.visitPlace)).toEqual([
      null,
      'school',
    ]);
    await expectApiError(
      () =>
        create(appointmentBody({ modality: ActivityModality.ExternalVisit })),
      400,
      'VALIDATION_ERROR',
    );
  });

  it.each(
    Object.values(ActivityState).filter(
      (status) => status !== ActivityState.Running,
    ),
  )('recusa a atividade %s, até para o admin', async (status) => {
    setup({ status });

    for (const account of [member, admin]) {
      const error = await expectApiError(
        () => create(appointmentBody(), account),
        409,
        'ACTIVITY_NOT_RUNNING',
      );
      expect(error.message).toBe(
        'Só uma atividade em andamento recebe atendimento.',
      );
    }
    expect(repo.created).toHaveLength(0);
  });

  it.each([
    PtsStateEnum.DRAFT,
    PtsStateEnum.REJECTED,
    PtsStateEnum.CONCLUDED,
    PtsStateEnum.CANCELLED,
  ])('recusa com o PTS em %s', async (status) => {
    setup({}, status);

    await expectApiError(() => create(), 409, 'PTS_NOT_ACTIVE');
  });

  it('aceita o PTS em planejamento', async () => {
    setup({}, PtsStateEnum.PLANNING);

    await create(appointmentBody(), responsible);
    expect(repo.created[0].authorProfessionalId).toBe('prof-1');
  });

  it('o profissional é sempre o autor, mesmo indicando outro', async () => {
    await create(appointmentBody({ authorProfessionalId: 'prof-1' }));

    expect(repo.created[0].authorProfessionalId).toBe('prof-2');
  });

  it('o admin atribui a um membro ou fica com a própria conta (RN029)', async () => {
    await create(appointmentBody({ authorProfessionalId: 'prof-2' }), admin);
    await create(appointmentBody(), admin);

    expect(
      repo.created.map((input) => [
        input.authorProfessionalId,
        input.executedByAccountId,
      ]),
    ).toEqual([
      ['prof-2', 'acc-admin'],
      [null, 'acc-admin'],
    ]);
    await expectApiError(
      () => create(appointmentBody({ authorProfessionalId: 'prof-9' }), admin),
      400,
      'VALIDATION_ERROR',
    );
  });

  it('nega a quem é de fora e ao paciente; 404 para a desconhecida', async () => {
    for (const account of [outsider, patient]) {
      await expectApiError(
        () => create(appointmentBody(), account),
        403,
        'FORBIDDEN',
      );
    }
    await expectApiError(
      () => create(appointmentBody(), member, 'act-x'),
      404,
      'ACTIVITY_NOT_FOUND',
    );
  });
});
