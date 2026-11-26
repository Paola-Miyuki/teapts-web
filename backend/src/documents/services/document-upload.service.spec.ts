import { jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { AccountRole } from '../../accounts/enums/account-role.enum';
import type { AccountContext } from '../../accounts/services/accounts.service';
import type { StorageService } from '../../storage/storage.service';
import type { DocumentAccessService } from './document-access.service';
import {
  DocumentUploadService,
  sanitizeFileName,
} from './document-upload.service';

const patientId = '7c1f0f0e-1d2b-4b43-8a6e-0f2b6c1d9e11';
const account: AccountContext = {
  accountId: 'admin-1',
  role: AccountRole.Admin,
  patientProfileId: null,
  professionalProfileIds: [],
};
const request = {
  fileName: 'Laudo Neurológico.pdf',
  mimeType: 'application/pdf' as const,
  sizeBytes: 820000,
};

function createService() {
  const access = {
    assertAccess:
      jest.fn<
        (
          account: AccountContext,
          patientId: string,
          mode: 'read' | 'write',
        ) => Promise<void>
      >(),
  };
  const storage = {
    createUploadUrl: jest.fn<StorageService['createUploadUrl']>(),
  };
  const expiresAt = new Date('2026-12-01T12:15:00.000Z');
  access.assertAccess.mockResolvedValue();
  storage.createUploadUrl.mockImplementation((fileKey) => ({
    url: `http://localhost:3000/storage/objects/${encodeURIComponent(fileKey)}?token=t`,
    expiresAt,
  }));

  return {
    access,
    storage,
    service: new DocumentUploadService(
      access as unknown as DocumentAccessService,
      storage as unknown as StorageService,
    ),
  };
}

describe('DocumentUploadService.createUploadUrl', () => {
  it('checks write access and returns the signed url, key and expiry', async () => {
    const { access, storage, service } = createService();

    const result = await service.createUploadUrl(account, patientId, request);

    expect(access.assertAccess).toHaveBeenCalledWith(
      account,
      patientId,
      'write',
    );
    expect(result.fileKey).toMatch(
      new RegExp(`^${patientId}/[0-9a-f-]{36}-Laudo-Neurologico\\.pdf$`),
    );
    expect(storage.createUploadUrl).toHaveBeenCalledWith(
      result.fileKey,
      'application/pdf',
    );
    expect(result.uploadUrl).toContain(encodeURIComponent(result.fileKey));
    expect(result.expiresAt).toBe('2026-12-01T12:15:00.000Z');
  });

  it('generates a different key for each request', async () => {
    const { service } = createService();

    const first = await service.createUploadUrl(account, patientId, request);
    const second = await service.createUploadUrl(account, patientId, request);

    expect(first.fileKey).not.toBe(second.fileKey);
  });

  it('does not create a URL when access is denied', async () => {
    const { access, storage, service } = createService();
    access.assertAccess.mockRejectedValue(new ForbiddenException());

    await expect(
      service.createUploadUrl(account, patientId, request),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(storage.createUploadUrl).not.toHaveBeenCalled();
  });
});

describe('sanitizeFileName', () => {
  it.each([
    ['Laudo Neurológico.pdf', 'Laudo-Neurologico.pdf'],
    ['../../etc/passwd', 'etc-passwd'],
    ['a b  c.docx', 'a-b-c.docx'],
    ['%$#', 'arquivo'],
    ['', 'arquivo'],
  ])('%s -> %s', (input, expected) => {
    expect(sanitizeFileName(input)).toBe(expected);
  });

  it('keeps the end of a long name, with the extension', () => {
    const name = sanitizeFileName(`${'a'.repeat(300)}.pdf`);

    expect(name).toHaveLength(100);
    expect(name.endsWith('.pdf')).toBe(true);
  });
});
