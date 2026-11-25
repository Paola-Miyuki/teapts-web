// Este arquivo testa a consulta do paciente aos próprios documentos
// (RFDOC007): a listagem de `GET /me/documents` e a regra do paciente na
// leitura de um documento.

import { jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { AccountRole } from '../../accounts/enums/account-role.enum';
import type { AccountContext } from '../../accounts/services/accounts.service';
import type { PatientsRepository } from '../../patients/repositories/patients.repository';
import type { StorageService } from '../../storage/storage.service';
import type { DocumentsRepository } from '../repositories/documents.repository';
import { DocumentAccessService } from './document-access.service';
import type { DocumentTimelineService } from './document-timeline.service';
import { DocumentsService } from './documents.service';

const patientId = 'patient-1';
const patient: AccountContext = {
  accountId: 'account-1',
  role: AccountRole.User,
  patientProfileId: patientId,
  professionalProfileIds: [],
};
const query = { page: 1, limit: 20 };

describe('DocumentsService.listMine', () => {
  function createService() {
    const documents = {
      findPage: jest.fn<DocumentsRepository['findPage']>(),
    };
    documents.findPage.mockResolvedValue({ rows: [], total: 0 });

    return {
      documents,
      service: new DocumentsService(
        {} as DataSource,
        {} as DocumentAccessService,
        documents as unknown as DocumentsRepository,
        {} as StorageService,
        {} as DocumentTimelineService,
      ),
    };
  }

  it('lists only the documents of the own patient that the account sent', async () => {
    const { documents, service } = createService();

    await expect(service.listMine(patient, query)).resolves.toEqual({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    expect(documents.findPage).toHaveBeenCalledWith(patientId, {
      ...query,
      uploadedByAccountId: 'account-1',
    });
  });

  it.each([
    ['an admin', { role: AccountRole.Admin, patientProfileId: null }],
    [
      'a professional',
      { patientProfileId: null, professionalProfileIds: ['p'] },
    ],
  ])(
    'answers 403 FORBIDDEN to %s without querying',
    async (_name, overrides) => {
      const { documents, service } = createService();

      const error: unknown = await service
        .listMine({ ...patient, ...overrides }, query)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        status: 'FORBIDDEN',
      });
      expect(documents.findPage).not.toHaveBeenCalled();
    },
  );
});

describe('DocumentAccessService.assertDocumentRead', () => {
  const own = { patientId, uploadedByAccountId: 'account-1' };

  function createAccess() {
    const repository = {
      patientExists: jest.fn<(id: string) => Promise<boolean>>(),
      findPatient: jest.fn<(scope: unknown, id: string) => Promise<unknown>>(),
    };
    repository.patientExists.mockResolvedValue(true);

    return {
      repository,
      access: new DocumentAccessService(
        repository as unknown as PatientsRepository,
      ),
    };
  }

  it('lets the patient read a document they sent', async () => {
    const { access } = createAccess();

    await expect(
      access.assertDocumentRead(patient, own),
    ).resolves.toBeUndefined();
  });

  it.each([
    ['sent by the team', { ...own, uploadedByAccountId: 'team-account' }],
    ['of another patient', { ...own, patientId: 'patient-2' }],
  ])('denies the patient a document %s', async (_name, document) => {
    const { access } = createAccess();

    const error: unknown = await access
      .assertDocumentRead(patient, document)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toEqual({
      status: 'FORBIDDEN',
      message: 'Você só acessa os documentos que enviou.',
    });
  });

  it('keeps the team rule for the admin and the professionals', async () => {
    const { repository, access } = createAccess();
    repository.findPatient.mockResolvedValue({ read_only: true });
    const professional: AccountContext = {
      ...patient,
      patientProfileId: null,
      professionalProfileIds: ['pro-1'],
    };

    await expect(
      access.assertDocumentRead(
        { ...patient, role: AccountRole.Admin, patientProfileId: null },
        own,
      ),
    ).resolves.toBeUndefined();
    await expect(
      access.assertDocumentRead(professional, own),
    ).resolves.toBeUndefined();

    repository.findPatient.mockResolvedValue(null);

    await expect(
      access.assertDocumentRead(professional, own),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
