// Este arquivo gera a URL de envio do documento (RFDOC001). Não grava nada em
// `document` nem em `stored_object`: o objeto só existe depois do `PUT`.

import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { AccountContext } from '../../accounts/services/accounts.service';
import { StorageService } from '../../storage/storage.service';
import type { CreateUploadUrlRequestDto } from '../dto/create-upload-url-request.dto';
import type { CreateUploadUrlResponseDto } from '../dto/create-upload-url-response.dto';
import { DocumentAccessService } from './document-access.service';

const MAX_NAME_LENGTH = 100;

/** Deixa só letras, números, ponto, hífen e sublinhado, sem acentos. */
export function sanitizeFileName(fileName: string): string {
  const cleaned = fileName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+/, '')
    .slice(-MAX_NAME_LENGTH);

  return cleaned || 'arquivo';
}

@Injectable()
export class DocumentUploadService {
  constructor(
    private readonly access: DocumentAccessService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Autoriza o envio e devolve a URL assinada, a chave do objeto e o
   * vencimento. A chave é `<patientId>/<uuid>-<nome>`, única, e o prefixo
   * permite à confirmação checar que ela é do paciente.
   *
   * @throws NotFoundException `PATIENT_NOT_FOUND`
   * @throws ForbiddenException `FORBIDDEN` sem acesso de escrita
   */
  async createUploadUrl(
    account: AccountContext,
    patientId: string,
    request: CreateUploadUrlRequestDto,
  ): Promise<CreateUploadUrlResponseDto> {
    await this.access.assertAccess(account, patientId, 'write');

    const fileKey = `${patientId}/${randomUUID()}-${sanitizeFileName(request.fileName)}`;
    const { url, expiresAt } = this.storage.createUploadUrl(
      fileKey,
      request.mimeType,
    );

    return { uploadUrl: url, fileKey, expiresAt: expiresAt.toISOString() };
  }
}
