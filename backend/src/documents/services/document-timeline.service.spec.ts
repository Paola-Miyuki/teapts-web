import { jest } from '@jest/globals';
import type { EntityManager } from 'typeorm';
import { AccountRole } from '../../accounts/enums/account-role.enum';
import type { AccountContext } from '../../accounts/services/accounts.service';
import { PtsEntity } from '../../pts/entities/pts.entity';
import { TimelineRecordTarget } from '../../timeline/enums/timeline-record-target.enum';
import { TimelineRecordType } from '../../timeline/enums/timeline-record-type.enum';
import type { TimelineRecorderService } from '../../timeline/services/timeline-recorder.service';
import type { DocumentEntity } from '../entities/document.entity';
import { DocumentTimelineService } from './document-timeline.service';

const document = {
  id: 'doc-1',
  patientId: 'patient-1',
  title: 'Laudo neurológico',
} as DocumentEntity;
const professional: AccountContext = {
  accountId: 'account-1',
  role: AccountRole.User,
  patientProfileId: null,
  professionalProfileIds: ['professional-1'],
};
const admin: AccountContext = {
  accountId: 'admin-1',
  role: AccountRole.Admin,
  patientProfileId: null,
  professionalProfileIds: [],
};

function createService(activePts: { id: string } | null) {
  const recorder = { record: jest.fn<TimelineRecorderService['record']>() };
  const manager = {
    findOne: jest.fn(() => Promise.resolve(activePts)),
  };

  return {
    recorder,
    manager,
    service: new DocumentTimelineService(
      recorder as unknown as TimelineRecorderService,
    ),
  };
}

describe('DocumentTimelineService.recordUploaded', () => {
  it('records document_uploaded on the active PTS in the same transaction', async () => {
    const { service, recorder, manager } = createService({ id: 'pts-1' });

    await service.recordUploaded(
      document,
      professional,
      manager as unknown as EntityManager,
    );

    expect(manager.findOne).toHaveBeenCalledWith(PtsEntity, expect.anything());
    expect(recorder.record).toHaveBeenCalledWith(
      {
        ptsId: 'pts-1',
        type: TimelineRecordType.DocumentUploaded,
        description: 'Documento "Laudo neurológico" enviado.',
        targetId: 'doc-1',
        targetType: TimelineRecordTarget.Document,
        authorProfessionalId: 'professional-1',
        executedByAccountId: 'account-1',
      },
      manager,
    );
  });

  describe('DocumentTimelineService.recordUpdated', () => {
    it('records document_updated with the document and actor on the active PTS', async () => {
      const { service, recorder, manager } = createService({ id: 'pts-1' });

      await service.recordUpdated(
        { ...document, title: 'Laudo atualizado' },
        professional,
        manager as unknown as EntityManager,
      );

      expect(recorder.record).toHaveBeenCalledWith(
        {
          ptsId: 'pts-1',
          type: TimelineRecordType.DocumentUpdated,
          description: 'Dados do documento "Laudo atualizado" atualizados.',
          targetId: 'doc-1',
          targetType: TimelineRecordTarget.Document,
          authorProfessionalId: 'professional-1',
          executedByAccountId: 'account-1',
        },
        manager,
      );
    });

    it('does not record an event when there is no active PTS', async () => {
      const { service, recorder, manager } = createService(null);

      await service.recordUpdated(
        document,
        admin,
        manager as unknown as EntityManager,
      );

      expect(recorder.record).not.toHaveBeenCalled();
    });
  });

  describe('DocumentTimelineService.recordDeleted', () => {
    it('records document_deleted with the actor on the active PTS', async () => {
      const { service, recorder, manager } = createService({ id: 'pts-1' });

      await service.recordDeleted(
        document,
        admin,
        manager as unknown as EntityManager,
      );

      expect(recorder.record).toHaveBeenCalledWith(
        {
          ptsId: 'pts-1',
          type: TimelineRecordType.DocumentDeleted,
          description: 'Documento "Laudo neurológico" excluído.',
          targetId: 'doc-1',
          targetType: TimelineRecordTarget.Document,
          authorProfessionalId: null,
          executedByAccountId: 'admin-1',
        },
        manager,
      );
    });

    it('does not record an event when there is no active PTS', async () => {
      const { service, recorder, manager } = createService(null);

      await service.recordDeleted(
        document,
        admin,
        manager as unknown as EntityManager,
      );

      expect(recorder.record).not.toHaveBeenCalled();
    });
  });

  it('leaves the author empty when the admin uploads', async () => {
    const { service, recorder, manager } = createService({ id: 'pts-1' });

    await service.recordUploaded(
      document,
      admin,
      manager as unknown as EntityManager,
    );

    expect(recorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        authorProfessionalId: null,
        executedByAccountId: 'admin-1',
      }),
      manager,
    );
  });

  it('records nothing when the patient has no active PTS', async () => {
    const { service, recorder, manager } = createService(null);

    await service.recordUploaded(
      document,
      professional,
      manager as unknown as EntityManager,
    );

    expect(recorder.record).not.toHaveBeenCalled();
  });
});
