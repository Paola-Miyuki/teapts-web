import { ApiProperty } from '@nestjs/swagger';

/** Resposta do `PATCH /documents/:id`. */
export class UpdateDocumentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty({ example: '2026-12-09T12:00:00.000Z' })
  updatedAt: string;
}
