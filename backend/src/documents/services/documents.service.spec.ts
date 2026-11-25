import { jest } from '@jest/globals';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { type DataSource, type EntityManager, QueryFailedError } from 'typeorm';
import { AccountRole } from '../../accounts/enums/account-role.enum';
import type { AccountContext } from '../../accounts/services/accounts.service';
import { Professional } from '../../professionals/entities/professional.entity';
import type { StorageService } from '../../storage/storage.service';
import type { ConfirmDocumentRequestDto } from '../dto/confirm-document-request.dto';
import type { DocumentEntity } from '../entities/document.entity';
import { DocumentCategory } from '../enums/document-category.enum';
import type { DocumentsRepository } from '../repositories/documents.repository';
import type { DocumentAccessService } from './document-access.service';
import type { DocumentTimelineService } from './document-timeline.service';
import { DocumentsService } from './documents.service';

const patientId = '7c1f0f0e-1d2b-4b43-8a6e-0f2b6c1d9e11';
const account: AccountContext = {
  accountId: 'admin-1',
  role: AccountRole.Admin,
  patientProfileId: null,
  professionalProfileIds: [],
};
const request: ConfirmDocumentRequestDto = {
  fileKey: `${patientId}/abc-laudo.pdf`,
  title: ' Laudo neurológico ',
  category: DocumentCategory.MEDICAL_REPORT,
};
const stored = {
  id: 'doc-1',
  patientId,
  title: 'Laudo neurológico',
  fileKey: `${patientId}/original.pdf`,
  category: DocumentCategory.MEDICAL_REPORT,
  mimeType: 'application/pdf',
  sizeBytes: 1024,
  description: 'Avaliação inicial',
  issueDate: null,
  createdAt: new Date('2026-12-01T12:00:00.000Z'),
  updatedAt: null,
  updatedByAccountId: null,
  deletedAt: null,
} as DocumentEntity;
const response = {
  id: 'doc-1',
  title: 'Laudo neurológico',
  category: 'medical_report',
  mimeType: 'application/pdf',
  sizeBytes: 1024,
  createdAt: '2026-12-01T12:00:00.000Z',
};

function uniqueViolation() {
  return new QueryFailedError('INSERT', [], {
    code: '23505',
  } as unknown as Error);
}

function createService() {
  const manager = {} as EntityManager;
  const professionals = {
    exists: jest.fn<(options: unknown) => Promise<boolean>>(),
  };
  const dataSource = {
    transaction: jest.fn((work: (manager: EntityManager) => Promise<unknown>) =>
      work(manager),
    ),
    getRepository: jest.fn(() => professionals),
  };
  const access = {
    assertAccess: jest.fn<DocumentAccessService['assertAccess']>(),
  };
  const documents = {
    findByFileKey: jest.fn<DocumentsRepository['findByFileKey']>(),
    create: jest.fn<DocumentsRepository['create']>(),
    findActiveById: jest.fn<DocumentsRepository['findActiveById']>(),
    save: jest.fn<DocumentsRepository['save']>(),
  };
  const storage = {
    headObject: jest.fn<StorageService['headObject']>(),
    activateObject: jest.fn<StorageService['activateObject']>(),
  };
  const timeline = {
    recordUploaded: jest.fn<DocumentTimelineService['recordUploaded']>(),
    recordUpdated: jest.fn<DocumentTimelineService['recordUpdated']>(),
  };

  access.assertAccess.mockResolvedValue();
  documents.findByFileKey.mockResolvedValue(null);
  documents.create.mockResolvedValue(stored);
  documents.findActiveById.mockImplementation(async () => ({ ...stored }));
  documents.save.mockImplementation(async (document) => document);
  storage.headObject.mockResolvedValue({
    mimeType: 'application/pdf',
    sizeBytes: 1024,
  });
  storage.activateObject.mockResolvedValue();
  timeline.recordUploaded.mockResolvedValue();
  timeline.recordUpdated.mockResolvedValue();

  return {
    manager,
    professionals,
    dataSource,
    access,
    documents,
    storage,
    timeline,
    service: new DocumentsService(
      dataSource as unknown as DataSource,
      access as unknown as DocumentAccessService,
      documents as unknown as DocumentsRepository,
      storage as unknown as StorageService,
      timeline as unknown as DocumentTimelineService,
    ),
  };
}

describe('DocumentsService.confirm', () => {
  it('creates the document with the storage data, activates the object and records the event', async () => {
    const ctx = createService();

    await expect(
      ctx.service.confirm(account, patientId, request),
    ).resolves.toEqual(response);

    expect(ctx.access.assertAccess).toHaveBeenCalledWith(
      account,
      patientId,
      'write',
    );
    expect(ctx.documents.create).toHaveBeenCalledWith(
      {
        patientId,
        title: 'Laudo neurológico',
        category: DocumentCategory.MEDICAL_REPORT,
        description: null,
        issueDate: null,
        issuerAccountId: null,
        issuerName: null,
        fileKey: request.fileKey,
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        uploadedByAccountId: 'admin-1',
      },
      ctx.manager,
    );
    expect(ctx.storage.activateObject).toHaveBeenCalledWith(
      request.fileKey,
      ctx.manager,
    );
    expect(ctx.timeline.recordUploaded).toHaveBeenCalledWith(
      stored,
      account,
      ctx.manager,
    );
  });

  describe('DocumentsService.update', () => {
    it('updates only metadata and records the event in the same transaction', async () => {
      const ctx = createService();
      const saved = {
        ...stored,
        title: 'Laudo neurológico (2026)',
        description: 'Avaliação de novembro.',
        updatedAt: new Date('2026-12-09T12:00:00.000Z'),
        updatedByAccountId: account.accountId,
      };
      ctx.documents.save.mockResolvedValue(saved);

      await expect(
        ctx.service.update(account, stored.id, {
          title: ' Laudo neurológico (2026) ',
          description: ' Avaliação de novembro. ',
        }),
      ).resolves.toEqual({
        id: stored.id,
        title: 'Laudo neurológico (2026)',
        description: 'Avaliação de novembro.',
        updatedAt: '2026-12-09T12:00:00.000Z',
      });

      expect(ctx.access.assertAccess).toHaveBeenCalledWith(
        account,
        patientId,
        'write',
      );
      expect(ctx.documents.save).toHaveBeenCalledWith(
        expect.objectContaining({
          fileKey: stored.fileKey,
          title: 'Laudo neurológico (2026)',
          description: 'Avaliação de novembro.',
          updatedByAccountId: account.accountId,
        }),
        ctx.manager,
      );
      expect(ctx.timeline.recordUpdated).toHaveBeenCalledWith(
        saved,
        account,
        ctx.manager,
      );
    });

    it('allows clearing the description without changing the file', async () => {
      const ctx = createService();
      ctx.documents.save.mockImplementation(async (document) => document);

      const updated = await ctx.service.update(account, stored.id, {
        description: null,
      });

      expect(ctx.documents.save).toHaveBeenCalledWith(
        expect.objectContaining({
          description: null,
          fileKey: stored.fileKey,
        }),
        ctx.manager,
      );
      expect(updated.description).toBeNull();
    });

    it('rejects an empty patch', async () => {
      const ctx = createService();

      await expect(
        ctx.service.update(account, stored.id, {}),
      ).rejects.toMatchObject({
        response: { status: 'VALIDATION_ERROR' },
      });
      expect(ctx.documents.save).not.toHaveBeenCalled();
    });

    it('returns DOCUMENT_NOT_FOUND for missing or deleted documents', async () => {
      const ctx = createService();
      ctx.documents.findActiveById.mockResolvedValue(null);

      await expect(
        ctx.service.update(account, stored.id, { title: 'Novo título' }),
      ).rejects.toMatchObject({
        response: { status: 'DOCUMENT_NOT_FOUND' },
      });
      expect(ctx.access.assertAccess).not.toHaveBeenCalled();
    });

    it('forbids accounts that are not administrators or professionals', async () => {
      const ctx = createService();
      const patientAccount: AccountContext = {
        ...account,
        role: AccountRole.User,
        patientProfileId: patientId,
      };

      await expect(
        ctx.service.update(patientAccount, stored.id, { title: 'Novo título' }),
      ).rejects.toMatchObject({ response: { status: 'FORBIDDEN' } });
      expect(ctx.access.assertAccess).not.toHaveBeenCalled();
    });
  });

  it('takes the type and size from the storage, not from the client', async () => {
    const ctx = createService();
    ctx.storage.headObject.mockResolvedValue({
      mimeType: 'image/png',
      sizeBytes: 77,
    });

    await ctx.service.confirm(account, patientId, {
      ...request,
      mimeType: 'application/pdf',
      sizeBytes: 999999,
    } as ConfirmDocumentRequestDto);

    expect(ctx.documents.create).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: 'image/png', sizeBytes: 77 }),
      ctx.manager,
    );
  });

  it('returns the existing document when the file key was already confirmed', async () => {
    const ctx = createService();
    ctx.documents.findByFileKey.mockResolvedValue(stored);

    await expect(
      ctx.service.confirm(account, patientId, request),
    ).resolves.toEqual(response);

    expect(ctx.documents.create).not.toHaveBeenCalled();
    expect(ctx.storage.activateObject).not.toHaveBeenCalled();
    expect(ctx.timeline.recordUploaded).not.toHaveBeenCalled();
  });

  it('answers 403 when the file key already belongs to another patient', async () => {
    const ctx = createService();
    ctx.documents.findByFileKey.mockResolvedValue({
      ...stored,
      patientId: 'other-patient',
    });

    await expect(
      ctx.service.confirm(account, patientId, request),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns the winner when two confirmations race on the unique key', async () => {
    const ctx = createService();
    ctx.documents.findByFileKey
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(stored);
    ctx.documents.create.mockRejectedValue(uniqueViolation());

    await expect(
      ctx.service.confirm(account, patientId, request),
    ).resolves.toEqual(response);
  });

  it('answers UPLOAD_NOT_FOUND when the object is not in the storage', async () => {
    const ctx = createService();
    ctx.storage.headObject.mockResolvedValue(null);

    await expect(
      ctx.service.confirm(account, patientId, request),
    ).rejects.toMatchObject({
      response: { status: 'UPLOAD_NOT_FOUND' },
    });
    expect(ctx.documents.create).not.toHaveBeenCalled();
  });

  it('answers UPLOAD_NOT_FOUND when the key is not prefixed by the patient', async () => {
    const ctx = createService();

    await expect(
      ctx.service.confirm(account, patientId, {
        ...request,
        fileKey: 'other-patient/abc-laudo.pdf',
      }),
    ).rejects.toMatchObject({ response: { status: 'UPLOAD_NOT_FOUND' } });
    expect(ctx.storage.headObject).not.toHaveBeenCalled();
  });

  it('propagates the access error without touching the storage', async () => {
    const ctx = createService();
    ctx.access.assertAccess.mockRejectedValue(new ForbiddenException());

    await expect(
      ctx.service.confirm(account, patientId, request),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(ctx.documents.findByFileKey).not.toHaveBeenCalled();
    expect(ctx.storage.headObject).not.toHaveBeenCalled();
  });

  it('saves a professional issuer after checking the account has a profile', async () => {
    const ctx = createService();
    ctx.professionals.exists.mockResolvedValue(true);

    await ctx.service.confirm(account, patientId, {
      ...request,
      issuerAccountId: 'professional-account',
    });

    expect(ctx.dataSource.getRepository).toHaveBeenCalledWith(Professional);
    expect(ctx.professionals.exists).toHaveBeenCalledWith({
      where: { accountId: 'professional-account' },
    });
    expect(ctx.documents.create).toHaveBeenCalledWith(
      expect.objectContaining({ issuerAccountId: 'professional-account' }),
      ctx.manager,
    );
  });

  it('rejects an issuer account that is not a professional', async () => {
    const ctx = createService();
    ctx.professionals.exists.mockResolvedValue(false);

    const error: unknown = await ctx.service
      .confirm(account, patientId, { ...request, issuerAccountId: 'x' })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toMatchObject({
      status: 'VALIDATION_ERROR',
    });
    expect(ctx.documents.create).not.toHaveBeenCalled();
  });

  it('saves the outside issuer, date and description trimmed', async () => {
    const ctx = createService();

    await ctx.service.confirm(account, patientId, {
      ...request,
      issueDate: '2026-11-20',
      issuerName: ' Dra. Marta Reis ',
      description: ' Laudo de 2026 ',
    });

    expect(ctx.documents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        issueDate: '2026-11-20',
        issuerName: 'Dra. Marta Reis',
        description: 'Laudo de 2026',
      }),
      ctx.manager,
    );
  });

  it('rethrows other database errors', async () => {
    const ctx = createService();
    ctx.documents.create.mockRejectedValue(new Error('boom'));

    await expect(
      ctx.service.confirm(account, patientId, request),
    ).rejects.toThrow('boom');
  });
});
