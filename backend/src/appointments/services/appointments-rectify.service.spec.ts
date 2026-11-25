import { InMemoryActivitiesRepository } from '../../activities/__tests__/activity-fixtures';
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
  APPOINTMENT_ID,
  InMemoryAppointmentsRepository,
  RECTIFICATION_ID,
  rectifyBody,
  storedAppointment,
  storedRectification,
} from '../__tests__/appointment-fixtures';
import { AppointmentsService } from './appointments.service';

describe('AppointmentsService.rectifyAppointment (RFACT007)', () => {
  let repo: InMemoryAppointmentsRepository;
  let service: AppointmentsService;

  const rectify = (
    body = rectifyBody(),
    account = member,
    id = APPOINTMENT_ID,
    now = new Date('2026-11-25T15:00:00.000Z'),
  ) => service.rectifyAppointment(id, body, account, now);

  beforeEach(() => {
    repo = new InMemoryAppointmentsRepository();
    repo.appointments.push(storedAppointment(), storedRectification());
    service = new AppointmentsService(
      repo,
      new InMemoryActivitiesRepository(),
      seededGoalsRepo(),
    );
  });

  it('o autor registra a retificação, ligada ao original', async () => {
    expect(await rectify()).toEqual({
      id: RECTIFICATION_ID,
      rectifiesAppointmentId: APPOINTMENT_ID,
      createdAt: '2026-11-04T12:00:00.000Z',
    });
    expect(repo.rectifications).toEqual([
      {
        ptsId: 'pts-1',
        appointmentId: APPOINTMENT_ID,
        values: {
          appointmentDate: '2026-11-03',
          startTime: '14:00',
          endTime: '14:50',
          modality: 'in_person',
          visitPlace: null,
          attendance: 'done',
          soapSubjective: rectifyBody().soapSubjective,
          soapObjective: rectifyBody().soapObjective,
          soapAssessment: rectifyBody().soapAssessment,
          soapPlan: rectifyBody().soapPlan,
          absenceReason: null,
        },
        reason: 'Horário de término registrado errado.',
        authorProfessionalId: 'prof-2',
        executedByAccountId: 'acc-2',
        description:
          'João Lima retificou o atendimento de 03/11/2026 da atividade Integração sensorial',
      },
    ]);
  });

  it('apara a justificativa e corrige para falta, sem SOAP', async () => {
    await rectify({
      ...absenceBody({ absenceReason: 'Doente' }),
      reason: '  Era falta.  ',
    });

    expect(repo.rectifications[0].reason).toBe('Era falta.');
    expect(repo.rectifications[0].values).toMatchObject({
      attendance: 'missed',
      endTime: null,
      soapPlan: null,
      absenceReason: 'Doente',
    });
  });

  it('retificar a retificação corrige o mesmo original', async () => {
    await rectify(rectifyBody(), member, RECTIFICATION_ID);

    expect(repo.rectifications[0].appointmentId).toBe(APPOINTMENT_ID);
  });

  it.each([
    ['o responsável que não é o autor', responsible],
    ['o admin', admin],
    ['o paciente', patient],
    ['quem é de fora', outsider],
  ])('nega %s', async (_name, account) => {
    const body = await expectApiError(
      () => rectify(rectifyBody(), account),
      403,
      'FORBIDDEN',
    );

    expect(body.message).toBe('Só o autor do atendimento pode retificá-lo.');
    expect(repo.rectifications).toHaveLength(0);
  });

  it('nega quando o atendimento não tem autor', async () => {
    repo.appointments[0].author = null;

    await expectApiError(() => rectify(), 403, 'FORBIDDEN');
  });

  it.each([
    ['sem o plano', { soapPlan: ' ' }],
    ['com o término antes do início', { endTime: '13:00' }],
    ['com data futura', { appointmentDate: '2026-12-01' }],
  ])('segue as regras do registro: recusa %s', async (_name, changes) => {
    await expectApiError(
      () => rectify(rectifyBody(changes)),
      400,
      'VALIDATION_ERROR',
    );
    expect(repo.rectifications).toHaveLength(0);
  });

  it('responde 404 sem o atendimento', async () => {
    await expectApiError(
      () => rectify(rectifyBody(), member, 'nao-existe'),
      404,
      'APPOINTMENT_NOT_FOUND',
    );
  });
});
