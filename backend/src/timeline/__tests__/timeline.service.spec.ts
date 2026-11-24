import type { AccountContext } from '../../accounts/services/accounts.service';
import { AccountRole } from '../../accounts/enums/account-role.enum';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import { expectApiError } from '../../pts/__tests__/test-utils';
import type { GetTimelineQueryDto } from '../dto/get-timeline-query.dto';
import { TimelineRecordTarget } from '../enums/timeline-record-target.enum';
import { TimelineService } from '../services/timeline.service';
import {
  ADMIN_ACCOUNT_ID,
  InMemoryTimelineRepository,
  MEMBER_ID,
  OTHER_PTS_ID,
  PATIENT_ID,
  PTS_ID,
  RESPONSIBLE_ID,
  seededTimelineRepo,
} from './in-memory-timeline.repository';

const query = (
  overrides: Partial<GetTimelineQueryDto> = {},
): GetTimelineQueryDto => ({ page: 1, limit: 20, ...overrides });

const account = (overrides: Partial<AccountContext>): AccountContext => ({
  accountId: 'acc-x',
  role: AccountRole.User,
  patientProfileId: null,
  professionalProfileIds: [],
  ...overrides,
});

const admin = account({ accountId: ADMIN_ACCOUNT_ID, role: AccountRole.Admin });
const responsible = account({
  accountId: 'acc-1',
  professionalProfileIds: [RESPONSIBLE_ID],
});
const member = account({
  accountId: 'acc-2',
  professionalProfileIds: [MEMBER_ID],
});
const patient = account({
  accountId: PATIENT_ID,
  patientProfileId: PATIENT_ID,
});

describe('TimelineService.findTimeline', () => {
  let repo: InMemoryTimelineRepository;
  let service: TimelineService;

  beforeEach(() => {
    repo = seededTimelineRepo();
    service = new TimelineService(repo);
  });

  it('retorna os eventos do PTS do mais recente ao mais antigo', async () => {
    const result = await service.findTimeline(PTS_ID, query(), responsible);

    expect(result.data.map((record) => record.id)).toEqual([
      'rec-4',
      'rec-3',
      'rec-2',
      'rec-1',
    ]);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 4,
      totalPages: 1,
    });
  });

  it('não mistura eventos de outro PTS', async () => {
    const result = await service.findTimeline(PTS_ID, query(), admin);

    expect(result.data.map((record) => record.id)).not.toContain('rec-other');
    expect(repo.lastFindInput?.ptsId).toBe(PTS_ID);
  });

  it('traz tipo, alvo, data, autor e o profissional atribuído (RN029)', async () => {
    const result = await service.findTimeline(PTS_ID, query(), admin);
    const created = result.data.find((record) => record.id === 'rec-1');

    expect(created).toEqual({
      id: 'rec-1',
      type: 'pts_created',
      targetType: 'pts',
      targetId: PTS_ID,
      description:
        'Admin criou o PTS e atribuiu Kaio Segunda Conta como responsável',
      happenedAt: '2026-11-01T09:00:00.000Z',
      author: { id: ADMIN_ACCOUNT_ID, name: 'Admin' },
      assignedTo: { id: RESPONSIBLE_ID, name: 'Kaio Segunda Conta' },
    });
  });

  it('pagina a lista', async () => {
    const result = await service.findTimeline(
      PTS_ID,
      query({ page: 2, limit: 3 }),
      admin,
    );

    expect(result.data.map((record) => record.id)).toEqual(['rec-1']);
    expect(result.pagination).toEqual({
      page: 2,
      limit: 3,
      total: 4,
      totalPages: 2,
    });
  });

  it('repassa a busca, o tipo, o autor, o período e a ordem ao repositório', async () => {
    await service.findTimeline(
      PTS_ID,
      query({
        q: 'atividade',
        type: [TimelineRecordTarget.Activity],
        authorId: '6f1e2d3c-4b5a-4968-8776-5a4b3c2d1e0f',
        from: '2026-11-01',
        to: '2026-11-30',
        order: 'asc',
      }),
      member,
    );

    expect(repo.lastFindInput).toEqual({
      ptsId: PTS_ID,
      q: 'atividade',
      types: [TimelineRecordTarget.Activity],
      authorId: '6f1e2d3c-4b5a-4968-8776-5a4b3c2d1e0f',
      from: '2026-11-01',
      to: '2026-11-30',
      order: 'asc',
      page: 1,
      limit: 20,
    });
  });

  it('filtra por tipo do evento', async () => {
    const result = await service.findTimeline(
      PTS_ID,
      query({
        type: [TimelineRecordTarget.TeamMember, TimelineRecordTarget.Document],
      }),
      admin,
    );

    expect(result.data.map((record) => record.id)).toEqual(['rec-4', 'rec-2']);
  });

  it('ordena do mais antigo ao mais recente com order=asc', async () => {
    const result = await service.findTimeline(
      PTS_ID,
      query({ order: 'asc' }),
      admin,
    );

    expect(result.data.map((record) => record.id)).toEqual([
      'rec-1',
      'rec-2',
      'rec-3',
      'rec-4',
    ]);
  });

  it('filtra pelo autor (quem executou), pela conta ou pelo perfil profissional', async () => {
    const byAccount = await service.findTimeline(
      PTS_ID,
      query({ authorId: 'acc-2' }),
      admin,
    );
    const byProfessional = await service.findTimeline(
      PTS_ID,
      query({ authorId: RESPONSIBLE_ID }),
      admin,
    );

    expect(byAccount.data.map((record) => record.id)).toEqual(['rec-4']);
    // rec-1 foi executado pelo admin, só atribuído ao responsável: não entra.
    expect(byProfessional.data.map((record) => record.id)).toEqual([
      'rec-3',
      'rec-2',
    ]);
  });

  it('rejeita período com início depois do fim', async () => {
    await expectApiError(
      () =>
        service.findTimeline(
          PTS_ID,
          query({ from: '2026-11-30', to: '2026-11-01' }),
          admin,
        ),
      400,
      'ERROR',
    );
    expect(repo.lastFindInput).toBeNull();
  });

  it('dá acesso ao membro da equipe', async () => {
    const result = await service.findTimeline(PTS_ID, query(), member);

    expect(result.data).toHaveLength(4);
  });

  it('dá ao paciente titular a mesma timeline, sem o alvo dos documentos', async () => {
    const result = await service.findTimeline(PTS_ID, query(), patient);
    const document = result.data.find((record) => record.id === 'rec-4');
    const activity = result.data.find((record) => record.id === 'rec-3');

    expect(result.data).toHaveLength(4);
    expect(document?.targetType).toBe('document');
    expect(document?.targetId).toBeNull();
    expect(activity?.targetId).toBe('target-rec-3');
  });

  it('mantém o alvo dos documentos para a equipe e o admin', async () => {
    for (const viewer of [admin, member]) {
      const result = await service.findTimeline(PTS_ID, query(), viewer);

      expect(
        result.data.find((record) => record.id === 'rec-4')?.targetId,
      ).toBe('doc-1');
    }
  });

  it('responde 403 ao profissional fora da equipe', async () => {
    const response = await expectApiError(
      () =>
        service.findTimeline(
          PTS_ID,
          query(),
          account({ professionalProfileIds: ['prof-99'] }),
        ),
      403,
      'FORBIDDEN',
    );

    expect(response.message).toBe('Você não tem acesso à timeline deste PTS.');
    expect(repo.lastFindInput).toBeNull();
  });

  it('responde 403 a outro paciente', async () => {
    await expectApiError(
      () =>
        service.findTimeline(
          PTS_ID,
          query(),
          account({ patientProfileId: 'acc-patient-99' }),
        ),
      403,
      'FORBIDDEN',
    );
  });

  it('responde 403 à conta sem perfil', async () => {
    await expectApiError(
      () => service.findTimeline(OTHER_PTS_ID, query(), account({})),
      403,
      'FORBIDDEN',
    );
  });

  it('não dá ao profissional a timeline do PTS rejeitado (RN016)', async () => {
    repo.pts[0].status = PtsStateEnum.REJECTED;

    await expectApiError(
      () => service.findTimeline(PTS_ID, query(), responsible),
      403,
      'FORBIDDEN',
    );
  });

  it('responde 404 quando o PTS não existe', async () => {
    await expectApiError(
      () => service.findTimeline('pts-999', query(), admin),
      404,
      'PTS_NOT_FOUND',
    );
  });
});
