import type { EntityManager } from 'typeorm';

import { TimelineRecordTarget } from '../enums/timeline-record-target.enum';
import { TimelineRecordType } from '../enums/timeline-record-type.enum';
import type { NewTimelineRecord } from '../repositories/timeline.repository';
import { TimelineRecorderService } from '../services/timeline-recorder.service';
import { InMemoryTimelineRepository } from './in-memory-timeline.repository';

const event: NewTimelineRecord = {
  ptsId: 'pts-100',
  type: TimelineRecordType.MemberRemoved,
  description: '  Kaio Segunda Conta removeu Ana Souza da equipe  ',
  targetId: 'prof-11',
  targetType: TimelineRecordTarget.TeamMember,
  authorProfessionalId: null,
  executedByAccountId: 'acc-admin',
};

describe('TimelineRecorderService.record', () => {
  let repo: InMemoryTimelineRepository;
  let recorder: TimelineRecorderService;

  beforeEach(() => {
    repo = new InMemoryTimelineRepository();
    recorder = new TimelineRecorderService(repo);
  });

  it('grava a conta que executou e o profissional atribuído (RN029)', async () => {
    await recorder.record({ ...event, authorProfessionalId: 'prof-10' });

    expect(repo.inserted).toEqual([
      {
        record: {
          ...event,
          description: 'Kaio Segunda Conta removeu Ana Souza da equipe',
          authorProfessionalId: 'prof-10',
        },
        manager: undefined,
      },
    ]);
  });

  it('grava sem profissional quando o admin age sem atribuir', async () => {
    await recorder.record(event);

    expect(repo.inserted[0].record).toMatchObject({
      authorProfessionalId: null,
      executedByAccountId: 'acc-admin',
    });
  });

  it('usa o manager da transação de quem chamou', async () => {
    const manager = {} as EntityManager;

    await recorder.record(event, manager);

    expect(repo.inserted[0].manager).toBe(manager);
  });

  it('recusa evento sem descrição', async () => {
    await expect(
      recorder.record({ ...event, description: '   ' }),
    ).rejects.toThrow('descrição');
    expect(repo.inserted).toHaveLength(0);
  });

  it.each(['ptsId', 'targetId', 'executedByAccountId'] as const)(
    'recusa evento sem %s',
    async (field) => {
      await expect(recorder.record({ ...event, [field]: '' })).rejects.toThrow(
        'PTS, do alvo e da conta',
      );
      expect(repo.inserted).toHaveLength(0);
    },
  );
});
