/*
- Este teste cobre os fluxos HTTP de equipe (RFEM001/RFEM002) com o AuthGuard
- real, o ValidationPipe global e o PtsService real. SuperTokens e repositório
- são trocados por dublês.
 */
import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';
import request from 'supertest';
import { createValidationPipe } from '../src/common/validation/create-validation-pipe';
import { PtsStateEnum } from '../src/database/enums/pts-state.enum';
import type {
  AddTeamMembersInput,
  TransferResponsibilityInput,
} from '../src/pts/repositories/pts.repository';

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

let PtsController: (typeof import('../src/pts/controllers/pts.controller.js'))['PtsController'];
let PtsService: (typeof import('../src/pts/services/pts.service.js'))['PtsService'];
let PtsRepository: (typeof import('../src/pts/repositories/pts.repository.js'))['PtsRepository'];
let AccountsService: (typeof import('../src/accounts/services/accounts.service.js'))['AccountsService'];
let AuthGuard: (typeof import('../src/auth/guards/auth.guard.js'))['AuthGuard'];

beforeAll(async () => {
  ({ PtsController } =
    await import('../src/pts/controllers/pts.controller.js'));
  ({ PtsService } = await import('../src/pts/services/pts.service.js'));
  ({ PtsRepository } =
    await import('../src/pts/repositories/pts.repository.js'));
  ({ AccountsService } =
    await import('../src/accounts/services/accounts.service.js'));
  ({ AuthGuard } = await import('../src/auth/guards/auth.guard.js'));
});

describe('equipe do PTS (e2e - RFEM001/RFEM002)', () => {
  const ptsId = '3f2e1d0c-9b8a-4765-a432-10fedcba9876';
  const responsibleId = '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
  const existingMemberId = '11111111-1111-4111-8111-111111111111';
  const newMemberId = '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a';
  const duplicateAccountMemberId = '22222222-2222-4222-8222-222222222222';
  const missingMemberId = '99999999-9999-4999-8999-999999999999';
  const route = `/pts/${ptsId}/team`;
  const transferRoute = `${route}/transfer-responsibility`;

  let app: INestApplication;
  let ptsExists: boolean;
  let status: PtsStateEnum;
  let responsibleProfessionalId: string;
  let teamMembers: Array<{ professionalId: string; accountId: string }>;

  let ptsRepository: {
    findPtsTeamTarget: jest.Mock<(id: string) => Promise<unknown>>;
    findProfessionalsWithAccountByIds: jest.Mock<
      (
        ids: string[],
      ) => Promise<Array<{ id: string; accountId: string; name: string }>>
    >;
    findAccountDisplayName: jest.Mock<
      (accountId: string) => Promise<string | null>
    >;
    addTeamMembers: jest.Mock<(input: AddTeamMembersInput) => Promise<unknown>>;
    transferResponsibility: jest.Mock<
      (input: TransferResponsibilityInput) => Promise<unknown>
    >;
  };

  function signIn(
    professionalProfileIds: string[],
    accountId = 'account-responsible',
  ) {
    currentSession = {
      getAccessTokenPayload: () => ({
        accountId,
        role: 'user',
        patientProfileId: null,
        professionalProfileIds,
      }),
    };
  }

  beforeEach(async () => {
    ptsExists = true;
    status = PtsStateEnum.PLANNING;
    responsibleProfessionalId = responsibleId;
    teamMembers = [
      { professionalId: existingMemberId, accountId: 'account-member-1' },
    ];

    const catalog = new Map<
      string,
      { id: string; accountId: string; name: string }
    >([
      [
        responsibleId,
        {
          id: responsibleId,
          accountId: 'account-responsible',
          name: 'Kaio Segunda Conta',
        },
      ],
      [
        existingMemberId,
        {
          id: existingMemberId,
          accountId: 'account-member-1',
          name: 'Profissional Equipe',
        },
      ],
      [
        newMemberId,
        {
          id: newMemberId,
          accountId: 'account-new-member',
          name: 'Kaio Felipe',
        },
      ],
      [
        duplicateAccountMemberId,
        {
          id: duplicateAccountMemberId,
          accountId: 'account-responsible',
          name: 'Outro Perfil',
        },
      ],
      [
        '33333333-3333-4333-8333-333333333333',
        {
          id: '33333333-3333-4333-8333-333333333333',
          accountId: 'account-member-1',
          name: 'Perfil com conta duplicada',
        },
      ],
    ]);

    ptsRepository = {
      findPtsTeamTarget: jest.fn(async () => {
        if (!ptsExists) {
          return null;
        }

        return {
          id: ptsId,
          status,
          responsibleProfessionalId,
          responsibleAccountId:
            catalog.get(responsibleProfessionalId)?.accountId ?? '',
          responsibleName: catalog.get(responsibleProfessionalId)?.name ?? '',
          teamMembers,
        };
      }),
      findProfessionalsWithAccountByIds: jest.fn(async (ids: string[]) =>
        ids
          .map((id) => catalog.get(id))
          .filter(
            (item): item is { id: string; accountId: string; name: string } =>
              item !== undefined,
          ),
      ),
      findAccountDisplayName: jest.fn(async () => null),
      addTeamMembers: jest.fn(async ({ members }: AddTeamMembersInput) => {
        for (const { professionalId: profId } of members) {
          const item = catalog.get(profId)!;
          teamMembers.push({
            professionalId: item.id,
            accountId: item.accountId,
          });
        }

        return {
          id: ptsId,
          status,
          responsible: {
            id: responsibleId,
            name: 'Kaio Segunda Conta',
            specialism: { id: 'psychologist', name: 'Psicologia' },
            registration: null,
          },
          team: teamMembers.map((m) => ({
            id: m.professionalId,
            name:
              m.professionalId === newMemberId
                ? 'Kaio Felipe'
                : 'Profissional Equipe',
            specialism: { id: 'doctor', name: 'Medicina' },
            registration: null,
          })),
        };
      }),
      transferResponsibility: jest.fn(
        async ({ newResponsibleId }: TransferResponsibilityInput) => {
          const nextResponsible = catalog.get(newResponsibleId)!;

          teamMembers = teamMembers.filter(
            (member) =>
              member.professionalId !== responsibleProfessionalId &&
              member.professionalId !== newResponsibleId,
          );
          responsibleProfessionalId = newResponsibleId;

          return {
            id: ptsId,
            status,
            responsible: {
              id: nextResponsible.id,
              name: nextResponsible.name,
              specialism: { id: 'doctor', name: 'Medicina' },
              registration: null,
            },
            team: teamMembers.map((member) => {
              const professional = catalog.get(member.professionalId)!;
              return {
                id: professional.id,
                name: professional.name,
                specialism: { id: 'doctor', name: 'Medicina' },
                registration: null,
              };
            }),
          };
        },
      ),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [PtsController],
      providers: [
        PtsService,
        AuthGuard,
        // O AuthGuard consulta a situação da conta (RFAUT005).
        { provide: AccountsService, useValue: { isActive: async () => true } },
        { provide: PtsRepository, useValue: ptsRepository },
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

  it('adiciona profissionais à equipe e responde 200 com a lista completa', async () => {
    signIn([responsibleId]);

    const response = await request(app.getHttpServer())
      .post(route)
      .send({ professionalIds: [newMemberId] });

    expect(response.status).toBe(200);
    expect(ptsRepository.addTeamMembers).toHaveBeenCalledWith({
      ptsId,
      members: [
        {
          professionalId: newMemberId,
          description: 'Kaio Segunda Conta adicionou Kaio Felipe à equipe',
        },
      ],
      authorProfessionalId: responsibleId,
      executedByAccountId: 'account-responsible',
    });
    expect(response.body).toMatchObject({
      id: ptsId,
      status: PtsStateEnum.PLANNING,
      responsible: { id: responsibleId },
      team: [{ id: existingMemberId }, { id: newMemberId }],
    });
  });

  it('responde 401 sem sessão', async () => {
    const response = await request(app.getHttpServer())
      .post(route)
      .send({ professionalIds: [newMemberId] });

    expect(response.status).toBe(401);
    expect(ptsRepository.findPtsTeamTarget).not.toHaveBeenCalled();
  });

  it('responde 400 VALIDATION_ERROR quando id não é UUID ou payload é inválido', async () => {
    signIn([responsibleId]);

    const invalidParam = await request(app.getHttpServer())
      .post('/pts/nao-e-uuid/team')
      .send({ professionalIds: [newMemberId] });

    expect(invalidParam.status).toBe(400);
    expect(invalidParam.body).toEqual({
      status: 'VALIDATION_ERROR',
      message: 'Parâmetro inválido: id',
    });

    const emptyList = await request(app.getHttpServer())
      .post(route)
      .send({ professionalIds: [] });

    expect(emptyList.status).toBe(400);
    expect(emptyList.body).toMatchObject({ status: 'VALIDATION_ERROR' });

    const duplicateInPayload = await request(app.getHttpServer())
      .post(route)
      .send({ professionalIds: [newMemberId, newMemberId] });

    expect(duplicateInPayload.status).toBe(400);
    expect(duplicateInPayload.body).toMatchObject({
      status: 'VALIDATION_ERROR',
    });
  });

  it('responde 400 TEAM_PROFESSIONAL_NOT_FOUND quando perfil não existe', async () => {
    signIn([responsibleId]);

    const response = await request(app.getHttpServer())
      .post(route)
      .send({ professionalIds: [newMemberId, missingMemberId] });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      status: 'TEAM_PROFESSIONAL_NOT_FOUND',
      professionalIds: [missingMemberId],
    });
    expect(ptsRepository.addTeamMembers).not.toHaveBeenCalled();
  });

  it('responde 400 TEAM_DUPLICATE_ACCOUNT quando a conta já está na equipe ou é responsável (RN008)', async () => {
    signIn([responsibleId]);

    const response = await request(app.getHttpServer())
      .post(route)
      .send({ professionalIds: [newMemberId, duplicateAccountMemberId] });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      status: 'TEAM_DUPLICATE_ACCOUNT',
      professionalIds: [duplicateAccountMemberId],
    });
    expect(ptsRepository.addTeamMembers).not.toHaveBeenCalled();
  });

  it('responde 403 FORBIDDEN quando outro profissional tenta adicionar membros', async () => {
    signIn([existingMemberId], 'account-member-1');

    const response = await request(app.getHttpServer())
      .post(route)
      .send({ professionalIds: [newMemberId] });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      status: 'FORBIDDEN',
      message: 'Somente o responsável pode alterar a equipe do PTS.',
    });
    expect(ptsRepository.addTeamMembers).not.toHaveBeenCalled();
  });

  it('responde 404 PTS_NOT_FOUND quando o PTS não existe', async () => {
    signIn([responsibleId]);
    ptsExists = false;

    const response = await request(app.getHttpServer())
      .post(route)
      .send({ professionalIds: [newMemberId] });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      status: 'PTS_NOT_FOUND',
      message: 'PTS não encontrado.',
    });
  });

  it('responde 409 PTS_NOT_ACTIVE quando o PTS não está em PLANNING ou RUNNING', async () => {
    signIn([responsibleId]);
    status = PtsStateEnum.DRAFT;

    const response = await request(app.getHttpServer())
      .post(route)
      .send({ professionalIds: [newMemberId] });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      status: 'PTS_NOT_ACTIVE',
      message: 'Somente PTS em PLANNING ou RUNNING podem ser alterados.',
    });
    expect(ptsRepository.addTeamMembers).not.toHaveBeenCalled();
  });

  it('transfere a responsabilidade e remove o substituto da equipe', async () => {
    signIn([responsibleId]);

    const response = await request(app.getHttpServer())
      .post(transferRoute)
      .send({ newResponsibleId: existingMemberId });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: ptsId,
      responsible: { id: existingMemberId, name: 'Profissional Equipe' },
      team: [],
    });
    expect(ptsRepository.transferResponsibility).toHaveBeenCalledWith({
      ptsId,
      newResponsibleId: existingMemberId,
      authorProfessionalId: responsibleId,
      executedByAccountId: 'account-responsible',
      description:
        'Kaio Segunda Conta transferiu a responsabilidade do PTS para Profissional Equipe',
    });
  });

  it('responde 401 sem sessão', async () => {
    const response = await request(app.getHttpServer())
      .post(transferRoute)
      .send({ newResponsibleId: newMemberId });

    expect(response.status).toBe(401);
    expect(ptsRepository.findPtsTeamTarget).not.toHaveBeenCalled();
  });

  it('responde 400 VALIDATION_ERROR para UUID ou payload inválido', async () => {
    signIn([responsibleId]);

    const invalidParam = await request(app.getHttpServer())
      .post('/pts/invalido/team/transfer-responsibility')
      .send({ newResponsibleId: newMemberId });
    const missingDestination = await request(app.getHttpServer())
      .post(transferRoute)
      .send({});

    expect(invalidParam.status).toBe(400);
    expect(invalidParam.body).toMatchObject({ status: 'VALIDATION_ERROR' });
    expect(missingDestination.status).toBe(400);
    expect(missingDestination.body).toMatchObject({
      status: 'VALIDATION_ERROR',
    });
    expect(ptsRepository.transferResponsibility).not.toHaveBeenCalled();
  });

  it('responde 400 NEW_RESPONSIBLE_NOT_FOUND para perfil inexistente', async () => {
    signIn([responsibleId]);

    const response = await request(app.getHttpServer())
      .post(transferRoute)
      .send({ newResponsibleId: missingMemberId });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      status: 'NEW_RESPONSIBLE_NOT_FOUND',
    });
    expect(ptsRepository.transferResponsibility).not.toHaveBeenCalled();
  });

  it('responde 400 NEW_RESPONSIBLE_INVALID quando o responsável atual é indicado', async () => {
    signIn([responsibleId]);

    const response = await request(app.getHttpServer())
      .post(transferRoute)
      .send({ newResponsibleId: responsibleId });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      status: 'NEW_RESPONSIBLE_INVALID',
    });
    expect(ptsRepository.transferResponsibility).not.toHaveBeenCalled();
  });

  it('responde 400 TEAM_DUPLICATE_ACCOUNT quando a conta já pertence a outro membro', async () => {
    signIn([responsibleId]);

    const response = await request(app.getHttpServer())
      .post(transferRoute)
      .send({ newResponsibleId: '33333333-3333-4333-8333-333333333333' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      status: 'TEAM_DUPLICATE_ACCOUNT',
      professionalIds: ['33333333-3333-4333-8333-333333333333'],
    });
    expect(ptsRepository.transferResponsibility).not.toHaveBeenCalled();
  });

  it('responde 403 FORBIDDEN quando outro profissional tenta transferir', async () => {
    signIn([existingMemberId], 'account-member-1');

    const response = await request(app.getHttpServer())
      .post(transferRoute)
      .send({ newResponsibleId: newMemberId });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ status: 'FORBIDDEN' });
    expect(ptsRepository.transferResponsibility).not.toHaveBeenCalled();
  });

  it('responde 404 PTS_NOT_FOUND quando o PTS não existe', async () => {
    signIn([responsibleId]);
    ptsExists = false;

    const response = await request(app.getHttpServer())
      .post(transferRoute)
      .send({ newResponsibleId: newMemberId });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ status: 'PTS_NOT_FOUND' });
    expect(ptsRepository.transferResponsibility).not.toHaveBeenCalled();
  });

  it('responde 409 PTS_NOT_ACTIVE para PTS fora de PLANNING e RUNNING', async () => {
    signIn([responsibleId]);
    status = PtsStateEnum.CONCLUDED;

    const response = await request(app.getHttpServer())
      .post(transferRoute)
      .send({ newResponsibleId: newMemberId });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ status: 'PTS_NOT_ACTIVE' });
    expect(ptsRepository.transferResponsibility).not.toHaveBeenCalled();
  });
});
