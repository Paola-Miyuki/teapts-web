// Este arquivo confirma o documento (RFDOC002): confere o objeto no storage,
// grava o `document`, ativa o objeto e registra o evento na timeline, tudo na
// mesma transação (o storage é o próprio Postgres). Repetir a `file_key` do
// mesmo paciente devolve o registro existente (RN015).

import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';
import type { AccountContext } from '../../accounts/services/accounts.service';
import { Professional } from '../../professionals/entities/professional.entity';
import { StorageService } from '../../storage/storage.service';
import type { ConfirmDocumentRequestDto } from '../dto/confirm-document-request.dto';
import type { DocumentResponseDto } from '../dto/document-response.dto';
import type { DocumentEntity } from '../entities/document.entity';
import {
  documentForbidden,
  invalidIssuerAccount,
  uploadNotFound,
} from '../documents.errors';
import { DocumentsRepository } from '../repositories/documents.repository';
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
}
