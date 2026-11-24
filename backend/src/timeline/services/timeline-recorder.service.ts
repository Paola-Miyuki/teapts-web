import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

import {
  TimelineRepository,
  type NewTimelineRecord,
} from '../repositories/timeline.repository';

@Injectable()
export class TimelineRecorderService {
  constructor(private readonly timelineRepository: TimelineRepository) {}

  // Passe o manager da transação da operação para o evento ser desfeito junto com ela.
  async record(
    event: NewTimelineRecord,
    manager?: EntityManager,
  ): Promise<void> {
    const description = event.description.trim();

    if (!description) {
      throw new Error('O evento da timeline precisa de uma descrição.');
    }

    if (!event.ptsId || !event.targetId || !event.executedByAccountId) {
      throw new Error(
        'O evento da timeline precisa do PTS, do alvo e da conta que executou.',
      );
    }

    await this.timelineRepository.insert({ ...event, description }, manager);
  }
}
