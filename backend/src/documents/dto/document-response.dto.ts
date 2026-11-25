// Contrato público do documento confirmado. É classe, e não interface, para
// aparecer no OpenAPI.

import { DocumentCategory } from '../enums/document-category.enum';

/** Documento do paciente. */
export class DocumentResponseDto {
  id: string;
  title: string;
  category: DocumentCategory;
  /** @example application/pdf */
  mimeType: string;
  /** Tamanho em bytes. */
  sizeBytes: number;
  /** Data do envio, em ISO 8601. */
  createdAt: string;
}
