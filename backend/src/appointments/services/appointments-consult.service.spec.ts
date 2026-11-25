import {
  InMemoryActivitiesRepository,
  storedActivity,
} from '../../activities/__tests__/activity-fixtures';
import { ActivityState } from '../../activities/enums/activity.enums';
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
import {
  APPOINTMENT_ID,
  InMemoryAppointmentsRepository,
  RECTIFICATION_ID,
  storedAppointment,
  storedRectification,
} from '../__tests__/appointment-fixtures';
import type { GetAppointmentsQueryDto } from '../dto/get-appointments-query.dto';
import { Attendance } from '../enums/attendance.enum';
import { AppointmentsService } from './appointments.service';

const MISSED_ID = '7e6d5c4b-3a29-4180-9f8e-7d6c5b4a3928';

describe('AppointmentsService – consultar atendimentos (RFACT006)', () => {
  let repo: InMemoryAppointmentsRepository;
  let service: AppointmentsService;

  const query = (
    overrides: Partial<GetAppointmentsQueryDto> = {},
  ): GetAppointmentsQueryDto => ({ page: 1, limit: 20, ...overrides });

  beforeEach(() => {
    repo = new InMemoryAppointmentsRepository();
    repo.appointments.push(
      storedAppointment({ rectified: true }),
      storedRectification(),
      storedAppointment({
        id: MISSED_ID,
        appointmentDate: '2026-11-01',
        endTime: null,
        attendance: Attendance.Missed,
        soapSubjective: null,
        soapObjective: null,
        soapAssessment: null,
        soapPlan: null,
        absenceReason: 'A criança estava doente.',
      }),
    );
    const activities = new InMemoryActivitiesRepository();
    activities.activities.push(
      storedActivity({ status: ActivityState.Running }),
    );
    service = new AppointmentsService(repo, activities, seededGoalsRepo());
  });

  describe('findAppointments', () => {
    it('o admin vê todos, sem escopo, só os originais e paginados', async () => {
      const result = await service.findAppointments(query(), admin);

      expect(repo.searches[0].scope).toBeNull();
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      });
      expect(result.data.map(({ id }) => id)).toEqual([
        APPOINTMENT_ID,
        MISSED_ID,
      ]);
      expect(result.data[0]).toEqual({
        id: APPOINTMENT_ID,
        appointmentDate: '2026-11-03',
        startTime: '14:00',
        endTime: '14:45',
        patient: { id: 'patient-1', name: 'Luna Prado' },
        pts: { id: 'pts-1', version: 1 },
        activity: {
          id: 'act-1',
          title: 'Integração sensorial',
          specialism: 'occupational_therapist',
        },
        author: {
          id: 'prof-2',
          name: 'João Lima',
          specialism: 'occupational_therapist',
        },
        modality: 'in_person',
        visitPlace: null,
        attendance: 'done',
        rectified: true,
      });
    });

    it('a lista não leva o SOAP, nem para a equipe', async () => {
      const result = await service.findAppointments(query(), member);

      expect(result.data[0]).not.toHaveProperty('soap');
      expect(result.data[0]).not.toHaveProperty('plan');
    });

    it('o profissional vê pelo escopo das equipes (RN016)', async () => {
      await service.findAppointments(query(), member);

      expect(repo.searches[0].scope).toEqual({
        patientId: null,
        professionalIds: ['prof-2'],
      });
    });

    it('o paciente vê só os próprios', async () => {
      await service.findAppointments(
        query({ patientId: 'patient-1' }),
        patient,
      );

      expect(repo.searches[0]).toMatchObject({
        patientId: 'patient-1',
        scope: { patientId: 'patient-1', professionalIds: [] },
      });
    });

    it('repassa os filtros e a paginação', async () => {
      await service.findAppointments(
        query({
          ptsId: 'pts-1',
          attendance: [Attendance.Missed],
          from: '2026-11-01',
          to: '2026-11-30',
          page: 2,
          limit: 10,
        }),
        responsible,
      );

      expect(repo.searches[0]).toMatchObject({
        ptsId: 'pts-1',
        attendance: ['missed'],
        from: '2026-11-01',
        to: '2026-11-30',
        page: 2,
        limit: 10,
      });
    });

    it('nega a conta sem perfil e o paciente que pede outro paciente', async () => {
      await expectApiError(
        () => service.findAppointments(query(), accountOf()),
        403,
        'FORBIDDEN',
      );
      const body = await expectApiError(
        () =>
          service.findAppointments(query({ patientId: 'patient-2' }), patient),
        403,
        'FORBIDDEN',
      );

      expect(body.message).toBe('Você não tem acesso a estes atendimentos.');
      expect(repo.searches).toHaveLength(0);
    });

    it('nega o PTS ou a atividade de outra equipe', async () => {
      await expectApiError(
        () => service.findAppointments(query({ ptsId: 'pts-1' }), outsider),
        403,
        'FORBIDDEN',
      );
      await expectApiError(
        () =>
          service.findAppointments(query({ activityId: 'act-1' }), outsider),
        403,
        'FORBIDDEN',
      );
    });

    it('responde 404 com o PTS ou a atividade que não existem', async () => {
      await expectApiError(
        () => service.findAppointments(query({ ptsId: 'pts-x' }), member),
        404,
        'PTS_NOT_FOUND',
      );
      await expectApiError(
        () => service.findAppointments(query({ activityId: 'act-x' }), member),
        404,
        'ACTIVITY_NOT_FOUND',
      );
    });
  });

  describe('findAppointment', () => {
    it('a equipe vê o SOAP, o autor, a data e as retificações', async () => {
      const details = await service.findAppointment(APPOINTMENT_ID, member);

      expect(details).toMatchObject({
        id: APPOINTMENT_ID,
        rectifiesAppointmentId: null,
        rectified: true,
        registeredBy: { id: 'acc-2', name: 'João Lima' },
        createdAt: '2026-11-03T17:50:00.000Z',
        soap: {
          subjective: 'Chegou tranquilo; a mãe relatou boa semana.',
          objective: 'Manteve o circuito por 15 minutos.',
          assessment: 'Avanço na tolerância a estímulos táteis.',
          plan: 'Repetir o circuito e orientar a família sobre a rotina.',
        },
        rectificationReason: null,
      });
      expect(details.endTime).toBe('14:45');
      expect(details.rectifications).toHaveLength(1);
      expect(details.rectifications[0]).toMatchObject({
        id: RECTIFICATION_ID,
        endTime: '14:50',
        rectificationReason: 'Horário de término registrado errado.',
        createdAt: '2026-11-04T12:00:00.000Z',
      });
    });

    it('o admin também vê tudo', async () => {
      const details = await service.findAppointment(APPOINTMENT_ID, admin);

      expect(details.soap).not.toBeNull();
      expect(details.rectifications[0].rectificationReason).toBe(
        'Horário de término registrado errado.',
      );
    });

    it('o paciente vê só o plano e a assinatura (RN028)', async () => {
      const details = await service.findAppointment(APPOINTMENT_ID, patient);

      expect(details).not.toHaveProperty('soap');
      expect(details).not.toHaveProperty('rectificationReason');
      expect(details.plan).toBe(
        'Repetir o circuito e orientar a família sobre a rotina.',
      );
      expect(details.author).toEqual({
        id: 'prof-2',
        name: 'João Lima',
        specialism: 'occupational_therapist',
      });
      expect(details.rectifications[0]).not.toHaveProperty('soap');
      expect(details.rectifications[0]).not.toHaveProperty(
        'rectificationReason',
      );
      expect(details.rectifications[0].plan).toBe(
        'Repetir o circuito e orientar a família sobre a rotina.',
      );
    });

    it('a falta não tem SOAP; o paciente vê o motivo', async () => {
      const team = await service.findAppointment(MISSED_ID, member);
      const own = await service.findAppointment(MISSED_ID, patient);

      expect(team.soap).toBeNull();
      expect(team.absenceReason).toBe('A criança estava doente.');
      expect(own.plan).toBeNull();
      expect(own.absenceReason).toBe('A criança estava doente.');
      expect(own.rectified).toBe(false);
    });

    it('a retificação aponta para o original e não tem retificações', async () => {
      const details = await service.findAppointment(RECTIFICATION_ID, member);

      expect(details.rectifiesAppointmentId).toBe(APPOINTMENT_ID);
      expect(details.rectifications).toEqual([]);
    });

    it('nega a quem é de fora e responde 404 sem o atendimento', async () => {
      await expectApiError(
        () => service.findAppointment(APPOINTMENT_ID, outsider),
        403,
        'FORBIDDEN',
      );
      await expectApiError(
        () => service.findAppointment('nao-existe', member),
        404,
        'APPOINTMENT_NOT_FOUND',
      );
    });
  });
});
