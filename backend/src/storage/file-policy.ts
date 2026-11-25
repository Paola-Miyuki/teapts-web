// Política dos arquivos aceitos pelo storage: tipos (PDF, PNG, JPG, DOC,
// DOCX) e tamanho máximo de 5 MB (decisoes-aprovadas.md §20). Vale para o
// pedido da URL e para o envio do arquivo.

import { BadRequestException } from '@nestjs/common';

export const MAX_FILE_SIZE_BYTES = 5_242_880;

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export const FILE_TYPE_NOT_ALLOWED_MESSAGE =
  'Tipo de arquivo não permitido. Envie PDF, PNG, JPG, DOC ou DOCX.';
export const FILE_TOO_LARGE_MESSAGE = 'O arquivo deve ter no máximo 5 MB.';

export function isAllowedMimeType(mimeType: string): boolean {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function fileTypeNotAllowed(): BadRequestException {
  return new BadRequestException({
    status: 'FILE_TYPE_NOT_ALLOWED',
    message: FILE_TYPE_NOT_ALLOWED_MESSAGE,
  });
}

export function fileTooLarge(): BadRequestException {
  return new BadRequestException({
    status: 'FILE_TOO_LARGE',
    message: FILE_TOO_LARGE_MESSAGE,
  });
}
