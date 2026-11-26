// Este arquivo registra na timeline do PTS os eventos de documento. Fica
// separado do DocumentsService para o `document_updated` e o
// `document_deleted` reaproveitarem a busca do PTS ativo e a autoria (RN029).

import { Injectable } from '@nestjs/common';
import { type EntityManager, In } from 'typeorm';
import type { AccountContext } from '../../accounts/services/accounts.service';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import { PtsEntity } from '../../pts/entities/pts.entity';
import { TimelineRecordTarget } from '../../timeline/enums/timeline-record-target.enum';
import { TimelineRecordType } from '../../timeline/enums/timeline-record-type.enum';
import { TimelineRecorderService } from '../../timeline/services/timeline-recorder.service';
import type { DocumentEntity } from '../entities/document.entity';

@Injectable()
export class DocumentTimelineService {
  constructor(private readonly recorder: TimelineRecorderService) {}

  /**
   * Registra `document_uploaded` no PTS ativo (planejamento ou execução) do
   * paciente, na transação do `manager`. Sem PTS ativo, nada é gravado, pois
   * `timeline_record.pts_id` é obrigatório.
   *
   * O autor é o perfil do profissional que enviou; o administrador e o
   * paciente ficam sem autor, só como executor (RN029).
   */
  async recordUploaded(
    document: DocumentEntity,
    account: AccountContext,
    manager: EntityManager,
  ): Promise<void> {
    const pts = await manager.findOne(PtsEntity, {
      where: {
        patientId: document.patientId,
        status: In([PtsStateEnum.PLANNING, PtsStateEnum.RUNNING]),
      },
      select: { id: true },
    });

    if (!pts) {
      return;
    }

    await this.recorder.record(
      {
        ptsId: pts.id,
        type: TimelineRecordType.DocumentUploaded,
        description: `Documento "${document.title}" enviado.`,
        targetId: document.id,
        targetType: TimelineRecordTarget.Document,
        authorProfessionalId: account.professionalProfileIds[0] ?? null,
        executedByAccountId: account.accountId,
      },
      manager,
    );
  }

  /** Registra `document_updated` no PTS ativo, na mesma transação. */
  async recordUpdated(
    document: DocumentEntity,
    account: AccountContext,
    manager: EntityManager,
  ): Promise<void> {
    const pts = await manager.findOne(PtsEntity, {
      where: {
        patientId: document.patientId,
        status: In([PtsStateEnum.PLANNING, PtsStateEnum.RUNNING]),
      },
      select: { id: true },
    });

    if (!pts) {
      return;
    }

    await this.recorder.record(
      {
        ptsId: pts.id,
        type: TimelineRecordType.DocumentUpdated,
        description: `Dados do documento "${document.title}" atualizados.`,
        targetId: document.id,
        targetType: TimelineRecordTarget.Document,
        authorProfessionalId: account.professionalProfileIds[0] ?? null,
        executedByAccountId: account.accountId,
      },
      manager,
    );
  }

  /** Registra `document_deleted` no PTS ativo, na mesma transação. */
  async recordDeleted(
    document: DocumentEntity,
    account: AccountContext,
    manager: EntityManager,
  ): Promise<void> {
    const pts = await manager.findOne(PtsEntity, {
      where: {
        patientId: document.patientId,
        status: In([PtsStateEnum.PLANNING, PtsStateEnum.RUNNING]),
      },
      select: { id: true },
    });

    if (!pts) {
      return;
    }

    await this.recorder.record(
      {
        ptsId: pts.id,
        type: TimelineRecordType.DocumentDeleted,
        description: `Documento "${document.title}" excluído.`,
        targetId: document.id,
        targetType: TimelineRecordTarget.Document,
        authorProfessionalId: account.professionalProfileIds[0] ?? null,
        executedByAccountId: account.accountId,
      },
      manager,
    );
  }
}
