// Este arquivo define e valida o corpo do pedido da URL de envio do documento.
// Os erros saem `{ status, message }` pelo pipe global; tipo e tamanho fora da
// política usam os códigos FILE_TYPE_NOT_ALLOWED e FILE_TOO_LARGE.

import { IsIn, IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';
import {
  ALLOWED_MIME_TYPES,
  FILE_TOO_LARGE_MESSAGE,
  FILE_TYPE_NOT_ALLOWED_MESSAGE,
  MAX_FILE_SIZE_BYTES,
} from '../../storage/file-policy';

/** Corpo do `POST /patients/:id/documents/upload-url`. */
export class CreateUploadUrlRequestDto {
  /**
   * Nome do arquivo escolhido.
   * @example laudo-neurologico.pdf
   */
  @IsString({ message: 'Informe o nome do arquivo.' })
  @IsNotEmpty({ message: 'Informe o nome do arquivo.' })
  fileName: string;

  /** @example application/pdf */
  @IsIn(ALLOWED_MIME_TYPES, {
    message: FILE_TYPE_NOT_ALLOWED_MESSAGE,
    context: { status: 'FILE_TYPE_NOT_ALLOWED' },
  })
  mimeType: (typeof ALLOWED_MIME_TYPES)[number];

  /**
   * Tamanho do arquivo em bytes, de 1 a 5 MB.
   * @example 820000
   */
  @Max(MAX_FILE_SIZE_BYTES, {
    message: FILE_TOO_LARGE_MESSAGE,
    context: { status: 'FILE_TOO_LARGE' },
  })
  @Min(1, { message: 'Informe o tamanho do arquivo.' })
  @IsInt({ message: 'Informe o tamanho do arquivo.' })
  sizeBytes: number;
}
