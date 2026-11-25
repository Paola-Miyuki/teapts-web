import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';
import request from 'supertest';
import { createValidationPipe } from '../src/common/validation/create-validation-pipe';
import { seededGoalsRepo } from '../src/pts/__tests__/goal-fixtures';
import {
  APPOINTMENT_ID,
  InMemoryAppointmentsRepository,
  RECTIFICATION_ID,
  rectifyBody,
  storedAppointment,
  storedRectification,
} from '../src/appointments/__tests__/appointment-fixtures';
import { InMemoryActivitiesRepository } from '../src/activities/__tests__/activity-fixtures';

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

let AppointmentController: (typeof import('../src/appointments/controllers/appointment.controller.js'))['AppointmentController'];
let AppointmentsService: (typeof import('../src/appointments/services/appointments.service.js'))['AppointmentsService'];
let ActivitiesRepository: (typeof import('../src/activities/repositories/activities.repository.js'))['ActivitiesRepository'];
let AppointmentsRepository: (typeof import('../src/appointments/repositories/appointments.repository.js'))['AppointmentsRepository'];
let PtsGoalsRepository: (typeof import('../src/pts/repositories/pts-goals.repository.js'))['PtsGoalsRepository'];
let AccountsService: (typeof import('../src/accounts/services/accounts.service.js'))['AccountsService'];
let AuthGuard: (typeof import('../src/auth/guards/auth.guard.js'))['AuthGuard'];

beforeAll(async () => {
  ({ AppointmentController } =
    await import('../src/appointments/controllers/appointment.controller.js'));
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

describe('consultar e retificar atendimentos (e2e - RFACT006 e RFACT007)', () => {
  const ptsId = '3f2e1d0c-9b8a-4765-a432-10fedcba9876';
  const patientId = '55555555-5555-4555-8555-555555555555';
  const responsibleId = '44444444-4444-4444-8444-444444444444';
  const memberId = '11111111-1111-4111-8111-111111111111';
  const otherId = '99999999-9999-4999-8999-999999999999';

  let app: INestApplication;
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

  const get = (path: string) => request(app.getHttpServer()).get(path);
  const rectify = (body: object = rectifyBody(), id = APPOINTMENT_ID) =>
    request(app.getHttpServer()).post(`/appointments/${id}/rectify`).send(body);

  beforeEach(async () => {
    const author = {
      id: memberId,
      name: 'João Lima',
      specialism: storedAppointment().activity.specialism,
    };
    appointments = new InMemoryAppointmentsRepository();
    appointments.appointments.push(
      storedAppointment({
        ptsId,
        pts: { id: ptsId, version: 1 },
        patient: { id: patientId, name: 'Luna Prado' },
        author,
        rectified: true,
      }),
      storedRectification({
        ptsId,
        pts: { id: ptsId, version: 1 },
        patient: { id: patientId, name: 'Luna Prado' },
        author,
      }),
    );
    const goalsRepo = seededGoalsRepo();
    Object.assign(goalsRepo.pts[0], {
      id: ptsId,
      patientId,
      responsibleProfessionalId: responsibleId,
      teamProfessionalIds: [memberId],
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [AppointmentController],
      providers: [
        AppointmentsService,
        AuthGuard,
        { provide: AccountsService, useValue: { isActive: async () => true } },
        {
          provide: ActivitiesRepository,
          useValue: new InMemoryActivitiesRepository(),
        },
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

  describe('GET /appointments', () => {
    it('a equipe recebe a página, só com os originais', async () => {
      signIn([memberId]);

      const response = await get(
        `/appointments?ptsId=${ptsId}&attendance=done&page=1&limit=20`,
      ).expect(200);

      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
      expect(response.body.data).toEqual([
        expect.objectContaining({
          id: APPOINTMENT_ID,
          author: expect.objectContaining({ name: 'João Lima' }),
          rectified: true,
        }),
      ]);
      expect(appointments.searches[0]).toMatchObject({
        ptsId,
        attendance: ['done'],
        scope: { patientId: null, professionalIds: [memberId] },
      });
    });

    it('aceita o filtro repetido ou separado por vírgula', async () => {
      signIn([], { role: 'admin' });

      await get(
        '/appointments?attendance=done,missed&modality=telehealth',
      ).expect(200);
      await get('/appointments?attendance=done&attendance=cancelled').expect(
        200,
      );

      expect(appointments.searches[0]).toMatchObject({
        attendance: ['done', 'missed'],
        modality: ['telehealth'],
        scope: null,
      });
      expect(appointments.searches[1].attendance).toEqual([
        'done',
        'cancelled',
      ]);
    });

    it.each([
      ['attendance', 'attendance=late'],
      ['specialism', 'specialism=astronaut'],
      ['from', 'from=2026-02-30'],
      ['page', 'page=0'],
      ['ptsId', 'ptsId=abc'],
    ])('responde 400 ERROR com %s inválido', async (parameter, search) => {
      signIn([memberId]);

      const response = await get(`/appointments?${search}`).expect(400);
      expect(response.body).toEqual({
        status: 'ERROR',
        message: `Parâmetro inválido: ${parameter}`,
      });
    });

    it('nega sem sessão, sem perfil e o PTS de outra equipe', async () => {
      await get('/appointments').expect(401);

      signIn([]);
      await get('/appointments').expect(403);

      signIn([otherId]);
      const response = await get(`/appointments?ptsId=${ptsId}`).expect(403);
      expect(response.body).toEqual({
        status: 'FORBIDDEN',
        message: 'Você não tem acesso a estes atendimentos.',
      });
    });
  });

  describe('GET /appointments/:id', () => {
    it('a equipe vê o SOAP e a retificação', async () => {
      signIn([responsibleId]);

      const response = await get(`/appointments/${APPOINTMENT_ID}`).expect(200);

      expect(response.body).toMatchObject({
        id: APPOINTMENT_ID,
        rectified: true,
        soap: { plan: storedAppointment().soapPlan },
        rectifications: [
          {
            id: RECTIFICATION_ID,
            rectificationReason: 'Horário de término registrado errado.',
          },
        ],
      });
    });

    it('o paciente vê só o plano (RN028)', async () => {
      signIn([], { patientProfileId: patientId });

      const response = await get(`/appointments/${APPOINTMENT_ID}`).expect(200);

      expect(response.body.plan).toBe(storedAppointment().soapPlan);
      expect(response.body).not.toHaveProperty('soap');
      expect(response.body.rectifications[0]).not.toHaveProperty(
        'rectificationReason',
      );
    });

    it('responde 400, 403 e 404', async () => {
      signIn([otherId]);
      await get('/appointments/x').expect(400);
      await get(`/appointments/${APPOINTMENT_ID}`).expect(403);

      const response = await get(`/appointments/${otherId}`).expect(404);
      expect(response.body).toMatchObject({ status: 'APPOINTMENT_NOT_FOUND' });
    });
  });

  describe('POST /appointments/:id/rectify', () => {
    it('o autor retifica e recebe 201', async () => {
      signIn([memberId]);

      const response = await rectify().expect(201);

      expect(response.body).toEqual({
        id: RECTIFICATION_ID,
        rectifiesAppointmentId: APPOINTMENT_ID,
        createdAt: '2026-11-04T12:00:00.000Z',
      });
      expect(appointments.rectifications[0]).toMatchObject({
        ptsId,
        reason: 'Horário de término registrado errado.',
        authorProfessionalId: memberId,
        executedByAccountId: 'account-1',
      });
    });

    it.each([
      ['sem a justificativa', { reason: undefined }],
      ['com a justificativa em branco', { reason: '   ' }],
      ['sem o plano', { soapPlan: ' ' }],
    ])('responde 400 VALIDATION_ERROR %s', async (_name, changes) => {
      signIn([memberId]);

      const response = await rectify({ ...rectifyBody(), ...changes }).expect(
        400,
      );
      expect(response.body).toMatchObject({ status: 'VALIDATION_ERROR' });
      expect(appointments.rectifications).toHaveLength(0);
    });

    it('nega outro profissional, mesmo da equipe', async () => {
      await rectify().expect(401);

      signIn([responsibleId]);
      const response = await rectify().expect(403);
      expect(response.body).toEqual({
        status: 'FORBIDDEN',
        message: 'Só o autor do atendimento pode retificá-lo.',
      });
    });

    it('responde 404 sem o atendimento', async () => {
      signIn([memberId]);

      await rectify(rectifyBody(), otherId).expect(404);
    });
  });
});
