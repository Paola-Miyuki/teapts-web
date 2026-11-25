import { InMemoryActivitiesRepository } from '../../activities/__tests__/activity-fixtures';
import {
  member,
  patient,
  seededGoalsRepo,
} from '../../pts/__tests__/goal-fixtures';
import {
  APPOINTMENT_ID,
  InMemoryAppointmentsRepository,
  rectifyBody,
  storedAppointment,
} from '../__tests__/appointment-fixtures';
import { AppointmentsService } from '../services/appointments.service';
import { AppointmentController } from './appointment.controller';

describe('AppointmentController (RFACT006 e RFACT007)', () => {
  let repo: InMemoryAppointmentsRepository;
  let controller: AppointmentController;

  beforeEach(() => {
    repo = new InMemoryAppointmentsRepository();
    repo.appointments.push(storedAppointment());
    controller = new AppointmentController(
      new AppointmentsService(
        repo,
        new InMemoryActivitiesRepository(),
        seededGoalsRepo(),
      ),
    );
  });

  it('lista pela conta da sessão', async () => {
    const result = await controller.findAppointments(
      { page: 1, limit: 20 },
      patient,
    );

    expect(result.data).toHaveLength(1);
    expect(repo.searches[0].scope).toEqual({
      patientId: 'patient-1',
      professionalIds: [],
    });
  });

  it('consulta um atendimento', async () => {
    const details = await controller.findAppointment(APPOINTMENT_ID, member);

    expect(details).toMatchObject({ id: APPOINTMENT_ID, rectified: false });
  });

  it('retifica pela conta da sessão', async () => {
    const created = await controller.rectifyAppointment(
      APPOINTMENT_ID,
      rectifyBody({ appointmentDate: '2026-01-10' }),
      member,
    );

    expect(created.rectifiesAppointmentId).toBe(APPOINTMENT_ID);
    expect(repo.rectifications[0].executedByAccountId).toBe(member.accountId);
  });
});
