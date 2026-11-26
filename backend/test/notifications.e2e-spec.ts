import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';
import request from 'supertest';
import { createValidationPipe } from '../src/common/validation/create-validation-pipe';
import { NotificationType } from '../src/notifications/enums/notification-type.enum';
import type { FindNotificationsInput } from '../src/notifications/repositories/notifications.repository';

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

let NotificationsController: (typeof import('../src/notifications/controllers/notifications.controller.js'))['NotificationsController'];
let NotificationsService: (typeof import('../src/notifications/services/notifications.service.js'))['NotificationsService'];
let NotificationsRepository: (typeof import('../src/notifications/repositories/notifications.repository.js'))['NotificationsRepository'];
let AccountsService: (typeof import('../src/accounts/services/accounts.service.js'))['AccountsService'];
let AuthGuard: (typeof import('../src/auth/guards/auth.guard.js'))['AuthGuard'];

beforeAll(async () => {
  ({ NotificationsController } =
    await import('../src/notifications/controllers/notifications.controller.js'));
  ({ NotificationsService } =
    await import('../src/notifications/services/notifications.service.js'));
  ({ NotificationsRepository } =
    await import('../src/notifications/repositories/notifications.repository.js'));
  ({ AccountsService } =
    await import('../src/accounts/services/accounts.service.js'));
  ({ AuthGuard } = await import('../src/auth/guards/auth.guard.js'));
});

describe('notificações (e2e - RFNOT002)', () => {
  const mine = '22222222-2222-4222-8222-222222222222';
  const mineRead = '33333333-3333-4333-8333-333333333333';
  const others = '44444444-4444-4444-8444-444444444444';

  let app: INestApplication;
  let rows: ReturnType<typeof stored>[];

  function stored(id: string, accountId: string, readAt: Date | null = null) {
    return {
      id,
      accountId,
      type: NotificationType.ReviewWindow,
      message: 'A reavaliação do PTS de Lívia vence em 30 dias (18/12/2026).',
      ptsId: '3f2e1d0c-9b8a-4765-a432-10fedcba9876',
      createdAt: new Date('2026-11-18T09:00:00.000Z'),
      readAt,
    };
  }

  function signIn(accountId = 'account-1') {
    currentSession = {
      getAccessTokenPayload: () => ({
        accountId,
        role: 'user',
        patientProfileId: null,
        professionalProfileIds: [],
      }),
    };
  }

  const http = () => request(app.getHttpServer());
  const unreadCount = async () =>
    (await http().get('/notifications/unread-count').expect(200)).body as {
      unreadCount: number;
    };

  beforeEach(async () => {
    rows = [
      stored(mine, 'account-1'),
      stored(mineRead, 'account-1', new Date('2026-11-19T10:00:00.000Z')),
      stored(others, 'account-2'),
    ];
    const ofAccount = (accountId: string) =>
      rows.filter((row) => row.accountId === accountId);
    const repository = {
      findByAccount: async ({ accountId, unread }: FindNotificationsInput) => {
        const found = ofAccount(accountId).filter(
          (row) => !unread || !row.readAt,
        );
        return { rows: found, total: found.length };
      },
      countUnread: async (accountId: string) =>
        ofAccount(accountId).filter((row) => !row.readAt).length,
      markAsRead: async (accountId: string, id: string) => {
        const found = ofAccount(accountId).find((row) => row.id === id);
        if (found) {
          found.readAt ??= new Date();
        }
        return found ?? null;
      },
      markAllAsRead: async (accountId: string) => {
        ofAccount(accountId).forEach((row) => (row.readAt ??= new Date()));
      },
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        NotificationsService,
        AuthGuard,
        { provide: AccountsService, useValue: { isActive: async () => true } },
        { provide: NotificationsRepository, useValue: repository },
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

  it('lista só as da conta, sem vazar o destinatário', async () => {
    signIn();

    const all = await http().get('/notifications').expect(200);
    expect(all.body.data.map((item: { id: string }) => item.id)).toEqual([
      mine,
      mineRead,
    ]);
    expect(Object.keys(all.body.data[0])).toEqual([
      'id',
      'type',
      'message',
      'ptsId',
      'createdAt',
      'readAt',
    ]);
    expect(all.body).toMatchObject({
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      unreadCount: 1,
    });

    const unread = await http().get('/notifications?unread=true').expect(200);
    expect(unread.body.data).toHaveLength(1);
  });

  it('marca como lida, atualiza o contador e não altera a já lida', async () => {
    signIn();
    expect(await unreadCount()).toEqual({ unreadCount: 1 });

    const read = await http().post(`/notifications/${mine}/read`).expect(200);
    expect(read.body.readAt).toEqual(expect.any(String));
    expect(await unreadCount()).toEqual({ unreadCount: 0 });

    const again = await http()
      .post(`/notifications/${mineRead}/read`)
      .expect(200);
    expect(again.body.readAt).toBe('2026-11-19T10:00:00.000Z');
  });

  it('marca todas só da própria conta', async () => {
    signIn();

    await http()
      .post('/notifications/read-all')
      .expect(200)
      .expect({ status: 'OK' });

    expect(await unreadCount()).toEqual({ unreadCount: 0 });
    expect(rows[2].readAt).toBeNull();
  });

  it('responde 404 para notificação de outra conta ou inexistente', async () => {
    signIn();

    for (const id of [others, '55555555-5555-4555-8555-555555555555']) {
      await http().post(`/notifications/${id}/read`).expect(404).expect({
        status: 'NOTIFICATION_NOT_FOUND',
        message: 'Notificação não encontrada.',
      });
    }
    expect(rows[2].readAt).toBeNull();
  });

  it('responde 400 com parâmetro inválido', async () => {
    signIn();

    await http().get('/notifications?unread=talvez').expect(400);
    await http().post('/notifications/x/read').expect(400);
  });

  it('responde 401 sem sessão em todas as rotas', async () => {
    await http().get('/notifications').expect(401);
    await http().get('/notifications/unread-count').expect(401);
    await http().post(`/notifications/${mine}/read`).expect(401);
    await http().post('/notifications/read-all').expect(401);
  });
});
