import { ApiProperty } from '@nestjs/swagger';

/** Resposta do `DELETE /documents/:id`. */
export class DeleteDocumentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: '2026-12-09T12:00:00.000Z' })
  deletedAt: string;
}
