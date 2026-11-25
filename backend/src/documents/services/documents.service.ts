// Este arquivo confirma o documento (RFDOC002): confere o objeto no storage,
// grava o `document`, ativa o objeto e registra o evento na timeline, tudo na
// mesma transação (o storage é o próprio Postgres). Repetir a `file_key` do
// mesmo paciente devolve o registro existente (RN015).

import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';
import type { AccountContext } from '../../accounts/services/accounts.service';
import { Professional } from '../../professionals/entities/professional.entity';
import { StorageService } from '../../storage/storage.service';
import { isAdmin } from '../../auth/account-context';
import type { ConfirmDocumentRequestDto } from '../dto/confirm-document-request.dto';
import { toPagination } from '../../common/pagination/pagination';
import type {
  DocumentListItemResponseDto,
  DocumentListResponseDto,
} from '../dto/document-list-response.dto';
import type { UpdateDocumentResponseDto } from '../dto/update-document-response.dto';
import type { DocumentResponseDto } from '../dto/document-response.dto';
import type { UpdateDocumentRequestDto } from '../dto/update-document-request.dto';
import type { DocumentUrlResponseDto } from '../dto/document-url-response.dto';
import type { GetDocumentsQueryDto } from '../dto/get-documents-query.dto';
import type { DocumentEntity } from '../entities/document.entity';
import {
  documentForbidden,
  documentNotFound,
  invalidIssuerAccount,
  onlyPatients,
  uploadNotFound,
} from '../documents.errors';
import {
  DocumentsRepository,
  type DocumentListRow,
} from '../repositories/documents.repository';
import { DocumentAccessService } from './document-access.service';
import { DocumentTimelineService } from './document-timeline.service';

/** Código do Postgres para violação de chave única (`unique_violation`). */
const UNIQUE_VIOLATION = '23505';

export function toDocumentResponse(
  document: DocumentEntity,
): DocumentResponseDto {
  return {
    id: document.id,
    title: document.title,
    category: document.category,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    createdAt: document.createdAt.toISOString(),
  };
}

function toListItem(row: DocumentListRow): DocumentListItemResponseDto {
  let issuer: DocumentListItemResponseDto['issuer'] = null;

  if (row.issuer_account_name !== null) {
    issuer = {
      name: row.issuer_account_name,
      ...(row.issuer_specialism !== null && {
        specialism: row.issuer_specialism,
      }),
      ...(row.issuer_institution !== null && {
        institution: row.issuer_institution,
      }),
      outsideSystem: false,
    };
  } else if (row.issuer_name !== null) {
    issuer = { name: row.issuer_name, outsideSystem: true };
  }

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    issuer,
    issueDate: row.issue_date,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    uploadedBy: {
      id: row.uploader_id,
      name: row.uploader_name,
      isPatient: row.uploaded_by_patient,
    },
    createdAt: row.created_at.toISOString(),
  };
}

@Injectable()
export class DocumentsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly access: DocumentAccessService,
    private readonly documents: DocumentsRepository,
    private readonly storage: StorageService,
    private readonly timeline: DocumentTimelineService,
  ) {}

  /**
   * Lista os documentos ativos do paciente (RFDOC003), do mais recente ao
   * mais antigo.
   *
   * @throws NotFoundException `PATIENT_NOT_FOUND`
   * @throws ForbiddenException `FORBIDDEN` para o paciente e para o
   *   profissional sem vínculo
   */
  async list(
    account: AccountContext,
    patientId: string,
    query: GetDocumentsQueryDto,
  ): Promise<DocumentListResponseDto> {
    await this.access.assertTeamRead(account, patientId);

    const { rows, total } = await this.documents.findPage(patientId, query);

    return {
      data: rows.map(toListItem),
      pagination: toPagination(query, total),
    };
  }

  /**
   * Lista só os documentos que o paciente titular enviou (RFDOC007).
   *
   * @throws ForbiddenException `FORBIDDEN` quando a conta não é de paciente
   */
  async listMine(
    account: AccountContext,
    query: GetDocumentsQueryDto,
  ): Promise<DocumentListResponseDto> {
    if (account.patientProfileId === null) {
      throw onlyPatients();
    }

    const { rows, total } = await this.documents.findPage(
      account.patientProfileId,
      { ...query, uploadedByAccountId: account.accountId },
    );

    return {
      data: rows.map(toListItem),
      pagination: toPagination(query, total),
    };
  }

  /**
   * Gera a URL temporária de leitura do arquivo do documento (RFDOC003).
   *
   * @throws NotFoundException `DOCUMENT_NOT_FOUND` quando não existe ou foi
   *   excluído
   * @throws ForbiddenException `FORBIDDEN` sem acesso ao documento
   */
  async getUrl(
    account: AccountContext,
    documentId: string,
  ): Promise<DocumentUrlResponseDto> {
    const document = await this.documents.findActiveById(documentId);

    if (!document) {
      throw documentNotFound();
    }

    await this.access.assertDocumentRead(account, document);

    const { url, expiresAt } = this.storage.createReadUrl(document.fileKey);

    return { url, expiresAt: expiresAt.toISOString() };
  }

  /**
   * Confirma o envio e devolve o documento.
   *
   * @throws NotFoundException `PATIENT_NOT_FOUND`
   * @throws ForbiddenException `FORBIDDEN` sem acesso de escrita, ou quando a
   *   `file_key` já é de outro paciente
   * @throws BadRequestException `UPLOAD_NOT_FOUND` quando a chave não é deste
   *   paciente ou o objeto não está no storage; `VALIDATION_ERROR` quando o
   *   emissor não é um profissional
   */
  async confirm(
    account: AccountContext,
    patientId: string,
    request: ConfirmDocumentRequestDto,
  ): Promise<DocumentResponseDto> {
    await this.access.assertAccess(account, patientId, 'write');

    const existing = await this.documents.findByFileKey(request.fileKey);

    if (existing) {
      if (existing.patientId !== patientId) {
        throw documentForbidden();
      }

      return toDocumentResponse(existing);
    }

    if (!request.fileKey.startsWith(`${patientId}/`)) {
      throw uploadNotFound();
    }

    const object = await this.storage.headObject(request.fileKey);

    if (!object) {
      throw uploadNotFound();
    }

    if (request.issuerAccountId) {
      const isProfessional = await this.dataSource
        .getRepository(Professional)
        .exists({ where: { accountId: request.issuerAccountId } });

      if (!isProfessional) {
        throw invalidIssuerAccount();
      }
    }

    try {
      const created = await this.dataSource.transaction(async (manager) => {
        const document = await this.documents.create(
          {
            patientId,
            title: request.title.trim(),
            category: request.category,
            description: request.description?.trim() || null,
            issueDate: request.issueDate ?? null,
            issuerAccountId: request.issuerAccountId ?? null,
            issuerName: request.issuerName?.trim() ?? null,
            fileKey: request.fileKey,
            mimeType: object.mimeType,
            sizeBytes: object.sizeBytes,
            uploadedByAccountId: account.accountId,
          },
          manager,
        );

        await this.storage.activateObject(request.fileKey, manager);
        await this.timeline.recordUploaded(document, account, manager);

        return document;
      });

      return toDocumentResponse(created);
    } catch (error) {
      // Duas confirmações ao mesmo tempo: a segunda perde na chave única e
      // devolve o registro da primeira.
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: unknown } | undefined)?.code ===
          UNIQUE_VIOLATION
      ) {
        const winner = await this.documents.findByFileKey(request.fileKey);

        if (winner && winner.patientId === patientId) {
          return toDocumentResponse(winner);
        }
      }

      throw error;
    }
  }

  async update(
    account: AccountContext,
    documentId: string,
    request: UpdateDocumentRequestDto,
  ): Promise<UpdateDocumentResponseDto> {
    if (request.title === undefined && request.description === undefined) {
      throw new BadRequestException({
        status: 'VALIDATION_ERROR',
        message: 'Informe o título ou a descrição.',
      });
    }

    if (request.title !== undefined && !request.title.trim()) {
      throw new BadRequestException({
        status: 'VALIDATION_ERROR',
        message: 'Informe o título.',
      });
    }

    const existing = await this.documents.findActiveById(documentId);

    if (!existing) {
      throw documentNotFound();
    }

    if (!isAdmin(account) && account.professionalProfileIds.length === 0) {
      throw documentForbidden();
    }

    await this.access.assertAccess(account, existing.patientId, 'write');

    const updated = await this.dataSource.transaction(async (manager) => {
      const document = await this.documents.findActiveById(documentId, manager);

      if (!document) {
        throw documentNotFound();
      }

      if (request.title !== undefined) {
        document.title = request.title.trim();
      }

      if (request.description !== undefined) {
        document.description = request.description?.trim() || null;
      }

      document.updatedAt = new Date();
      document.updatedByAccountId = account.accountId;

      const saved = await this.documents.save(document, manager);

      await this.timeline.recordUpdated(saved, account, manager);

      return saved;
    });

    if (!updated.updatedAt) {
      throw new Error('A atualização do documento não retornou updatedAt.');
    }

    return {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}
