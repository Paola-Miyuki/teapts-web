import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

import {
  TimelineRepository,
  type NewTimelineRecord,
} from '../repositories/timeline.repository';

/**
 * Registro de eventos da timeline (RFTL001), usado pelos módulos que alteram
 * o PTS. Grava a conta que executou e, quando houver, o profissional
 * atribuído (RN029).
 */
@Injectable()
export class TimelineRecorderService {
  constructor(private readonly timelineRepository: TimelineRepository) {}

  /**
   * Grava um evento. Passe o `manager` da transação da operação para que o
   * evento seja desfeito junto com ela.
   *
   * @throws Error quando faltam a descrição, o PTS, o alvo ou a conta
   */
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
