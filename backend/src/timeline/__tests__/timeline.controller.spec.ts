import type { AccountContext } from '../../accounts/services/accounts.service';
import { AccountRole } from '../../accounts/enums/account-role.enum';
import { expectApiError } from '../../pts/__tests__/test-utils';
import { TimelineController } from '../controllers/timeline.controller';
import { TimelineRecordTarget } from '../enums/timeline-record-target.enum';
import { TimelineService } from '../services/timeline.service';
import {
  InMemoryTimelineRepository,
  MEMBER_ID,
  PATIENT_ID,
  PTS_ID,
  seededTimelineRepo,
} from './in-memory-timeline.repository';

const member: AccountContext = {
  accountId: 'acc-2',
  role: AccountRole.User,
  patientProfileId: null,
  professionalProfileIds: [MEMBER_ID],
};

const patient: AccountContext = {
  accountId: PATIENT_ID,
  role: AccountRole.User,
  patientProfileId: PATIENT_ID,
  professionalProfileIds: [],
};

describe('TimelineController GET /pts/:id/timeline', () => {
  let repo: InMemoryTimelineRepository;
  let controller: TimelineController;

  beforeEach(() => {
    repo = seededTimelineRepo();
    controller = new TimelineController(new TimelineService(repo));
  });

  it('retorna os eventos paginados para o membro da equipe', async () => {
    const result = await controller.findTimeline(
      PTS_ID,
      { type: [TimelineRecordTarget.Activity], page: 1, limit: 20 },
      member,
    );

    expect(result).toEqual({
      data: [
        {
          id: 'rec-3',
          type: 'activity_approved',
          targetType: 'activity',
          targetId: 'target-rec-3',
          description: 'Kaio aprovou a atividade Integração sensorial',
          happenedAt: '2026-11-12T14:45:00.000Z',
          author: { id: 'acc-1', name: 'Kaio Segunda Conta' },
          assignedTo: null,
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it('esconde do paciente o alvo dos eventos de documento', async () => {
    const result = await controller.findTimeline(
      PTS_ID,
      { type: [TimelineRecordTarget.Document], page: 1, limit: 20 },
      patient,
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0].targetId).toBeNull();
  });

  it('responde 403 a quem não tem acesso', async () => {
    await expectApiError(
      () =>
        controller.findTimeline(
          PTS_ID,
          { page: 1, limit: 20 },
          { ...member, professionalProfileIds: ['prof-99'] },
        ),
      403,
      'FORBIDDEN',
    );
  });

  it('responde 404 quando o PTS não existe', async () => {
    await expectApiError(
      () => controller.findTimeline('pts-999', { page: 1, limit: 20 }, member),
      404,
      'PTS_NOT_FOUND',
    );
  });
});
