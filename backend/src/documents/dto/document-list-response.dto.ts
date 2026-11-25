// Contrato público da listagem de documentos (RFDOC003). São classes, e não
// interfaces, para aparecerem no OpenAPI.

import { ApiProperty } from '@nestjs/swagger';
import { PaginationResponseDto } from '../../common/pagination/pagination-response.dto';
import { DocumentCategory } from '../enums/document-category.enum';

/** Quem emitiu o documento: um profissional do sistema ou alguém de fora. */
export class DocumentIssuerResponseDto {
  /** @example Dra. Marta Reis */
  name: string;
  /** Especialidade do profissional; ausente para o emissor de fora. */
  @ApiProperty({ required: false, example: 'neurologist' })
  specialism?: string;
  /** Instituição do profissional, quando cadastrada. */
  @ApiProperty({ required: false, example: 'IMA' })
  institution?: string;
  /** `true` quando o emissor é um texto livre, fora do sistema. */
  outsideSystem: boolean;
}

/** Quem enviou o documento. */
export class DocumentUploaderResponseDto {
  id: string;
  name: string;
  /** `true` quando quem enviou foi o próprio paciente. */
  isPatient: boolean;
}

/** Metadados de um documento da lista. */
export class DocumentListItemResponseDto {
  id: string;
  title: string;
  /** Descrição do documento; `null` quando não informada. */
  @ApiProperty({ type: String, nullable: true })
  description: string | null;
  category: DocumentCategory;
  @ApiProperty({ type: DocumentIssuerResponseDto, nullable: true })
  issuer: DocumentIssuerResponseDto | null;
  /** Data de emissão, `YYYY-MM-DD`; `null` quando não informada. */
  @ApiProperty({ type: String, nullable: true, example: '2026-11-20' })
  issueDate: string | null;
  /** @example application/pdf */
  mimeType: string;
  /** Tamanho em bytes. */
  sizeBytes: number;
  uploadedBy: DocumentUploaderResponseDto;
  /** Data do envio, em ISO 8601. */
  createdAt: string;
}

/** Página de documentos do paciente. */
export class DocumentListResponseDto {
  data: DocumentListItemResponseDto[];
  pagination: PaginationResponseDto;
}
