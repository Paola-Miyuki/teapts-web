import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';
import request from 'supertest';
import { createValidationPipe } from '../src/common/validation/create-validation-pipe';
import { PtsStateEnum } from '../src/database/enums/pts-state.enum';
import { seededGoalsRepo } from '../src/pts/__tests__/goal-fixtures';
import {
  absenceBody,
  appointmentBody,
  InMemoryAppointmentsRepository,
} from '../src/appointments/__tests__/appointment-fixtures';
import { ActivityState } from '../src/activities/enums/activity.enums';
import {
  InMemoryActivitiesRepository,
  storedActivity,
} from '../src/activities/__tests__/activity-fixtures';

type SessionMiddleware = (
  request: Request,
  response: Response,
  next: (error?: unknown) => void,
) => Promise<void>;

let currentSession: Record<string, unknown> | undefined;

jest.unstable_mockModule(
  'supertokens-node/recipe/session/framework/express',
  () => ({
    verifySession: jest.fn<(options?: unknown) => SessionMiddleware>(
      () => async (req, _res, next) => {
        if (currentSession) {
          (req as Request & { session?: unknown }).session = currentSession;
        }

        next();
      },
    ),
  }),
);

let AppointmentsController: (typeof import('../src/appointments/controllers/appointments.controller.js'))['AppointmentsController'];
let AppointmentsService: (typeof import('../src/appointments/services/appointments.service.js'))['AppointmentsService'];
let ActivitiesRepository: (typeof import('../src/activities/repositories/activities.repository.js'))['ActivitiesRepository'];
let AppointmentsRepository: (typeof import('../src/appointments/repositories/appointments.repository.js'))['AppointmentsRepository'];
let PtsGoalsRepository: (typeof import('../src/pts/repositories/pts-goals.repository.js'))['PtsGoalsRepository'];
let AccountsService: (typeof import('../src/accounts/services/accounts.service.js'))['AccountsService'];
let AuthGuard: (typeof import('../src/auth/guards/auth.guard.js'))['AuthGuard'];

beforeAll(async () => {
  ({ AppointmentsController } =
    await import('../src/appointments/controllers/appointments.controller.js'));
  ({ AppointmentsService } =
    await import('../src/appointments/services/appointments.service.js'));
  ({ ActivitiesRepository } =
    await import('../src/activities/repositories/activities.repository.js'));
  ({ AppointmentsRepository } =
    await import('../src/appointments/repositories/appointments.repository.js'));
  ({ PtsGoalsRepository } =
    await import('../src/pts/repositories/pts-goals.repository.js'));
  ({ AccountsService } =
    await import('../src/accounts/services/accounts.service.js'));
  ({ AuthGuard } = await import('../src/auth/guards/auth.guard.js'));
});

describe('registrar atendimento (e2e - RFACT004)', () => {
  const ptsId = '3f2e1d0c-9b8a-4765-a432-10fedcba9876';
  const activityId = '66666666-6666-4666-8666-666666666660';
  const responsibleId = '44444444-4444-4444-8444-444444444444';
  const memberId = '11111111-1111-4111-8111-111111111111';
  const otherId = '99999999-9999-4999-8999-999999999999';
  const route = `/activities/${activityId}/appointments`;

  let app: INestApplication;
  let goalsRepo: ReturnType<typeof seededGoalsRepo>;
  let repo: InMemoryActivitiesRepository;
  let appointments: InMemoryAppointmentsRepository;

  function signIn(
    professionalProfileIds: string[],
    options: { role?: string; patientProfileId?: string | null } = {},
  ) {
    currentSession = {
      getAccessTokenPayload: () => ({
        accountId: 'account-1',
        role: options.role ?? 'user',
        patientProfileId: options.patientProfileId ?? null,
        professionalProfileIds,
      }),
    };
  }

  const post = (body: object = appointmentBody(), path = route) =>
    request(app.getHttpServer()).post(path).send(body);

  beforeEach(async () => {
    appointments = new InMemoryAppointmentsRepository();
    repo = new InMemoryActivitiesRepository();
    repo.activities.push(
      storedActivity({
        id: activityId,
        ptsId,
        authorProfessionalId: responsibleId,
        status: ActivityState.Running,
      }),
    );
    goalsRepo = seededGoalsRepo();
    Object.assign(goalsRepo.pts[0], {
      id: ptsId,
      responsibleProfessionalId: responsibleId,
      teamProfessionalIds: [memberId],
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [AppointmentsController],
      providers: [
        AppointmentsService,
        AuthGuard,
        { provide: AccountsService, useValue: { isActive: async () => true } },
        { provide: ActivitiesRepository, useValue: repo },
        { provide: AppointmentsRepository, useValue: appointments },
        { provide: PtsGoalsRepository, useValue: goalsRepo },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useLogger(false);
    app.useGlobalPipes(createValidationPipe());
    await app.init();
  });

  afterEach(async () => {
    currentSession = undefined;
    await app.close();
  });

  it('um membro registra o realizado e recebe 201', async () => {
    signIn([memberId]);

    const response = await post().expect(201);

    expect(response.body).toEqual({
      id: '2b1a0f9e-8d7c-4b6a-9e5d-4c3b2a190807',
      activityId,
      attendance: 'done',
      appointmentDate: '2026-11-03',
      createdAt: '2026-11-03T17:50:00.000Z',
    });
    expect(appointments.created[0]).toMatchObject({
      authorProfessionalId: memberId,
      executedByAccountId: 'account-1',
    });
  });

  it('registra a falta sem SOAP; o admin atribui a autoria (RN029)', async () => {
    signIn([], { role: 'admin' });

    await post(
      absenceBody({ absenceReason: 'Doente', authorProfessionalId: memberId }),
    ).expect(201);
    expect(appointments.created[0]).toMatchObject({
      values: { attendance: 'missed', absenceReason: 'Doente' },
      authorProfessionalId: memberId,
    });
  });

  it.each([
    ['sem o plano', { soapPlan: ' ' }],
    ['sem a hora de término', { endTime: undefined }],
    ['com o término antes do início', { endTime: '13:00' }],
    ['com data futura', { appointmentDate: '2999-01-01' }],
    ['com data impossível', { appointmentDate: '2026-02-30' }],
    ['com visita externa sem local', { modality: 'external_visit' }],
  ])('responde 400 VALIDATION_ERROR %s', async (_name, changes) => {
    signIn([memberId]);

    const response = await post({ ...appointmentBody(), ...changes }).expect(
      400,
    );
    expect(response.body).toMatchObject({ status: 'VALIDATION_ERROR' });
    expect(appointments.created).toHaveLength(0);
  });

  it('responde 400 com SOAP na falta e com o id inválido', async () => {
    signIn([memberId]);

    await post({ ...absenceBody(), soapPlan: 'Plano' }).expect(400);
    await post(appointmentBody(), '/activities/x/appointments').expect(400);
  });

  it('nega sem sessão, a quem é de fora e ao paciente', async () => {
    await post().expect(401);

    signIn([otherId]);
    const outsider = await post().expect(403);
    expect(outsider.body).toMatchObject({ status: 'FORBIDDEN' });

    signIn([], { patientProfileId: 'patient-1' });
    await post().expect(403);
  });

  it('responde 404 ACTIVITY_NOT_FOUND', async () => {
    signIn([memberId]);

    const response = await post(
      appointmentBody(),
      `/activities/${otherId}/appointments`,
    ).expect(404);
    expect(response.body).toMatchObject({ status: 'ACTIVITY_NOT_FOUND' });
  });

  it.each([ActivityState.Suspended, ActivityState.Concluded])(
    'responde 409 ACTIVITY_NOT_RUNNING com a atividade %s',
    async (status) => {
      repo.activities[0].status = status;
      signIn([memberId]);

      const response = await post().expect(409);
      expect(response.body).toEqual({
        status: 'ACTIVITY_NOT_RUNNING',
        message: 'Só uma atividade em andamento recebe atendimento.',
      });
    },
  );

  it('responde 409 PTS_NOT_ACTIVE com o PTS encerrado', async () => {
    goalsRepo.pts[0].status = PtsStateEnum.CANCELLED;
    signIn([memberId]);

    const response = await post().expect(409);
    expect(response.body).toMatchObject({ status: 'PTS_NOT_ACTIVE' });
  });
});
