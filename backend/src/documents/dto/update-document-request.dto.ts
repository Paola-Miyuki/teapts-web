import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, ValidateIf } from 'class-validator';

/** Corpo do `PATCH /documents/:id`. */
export class UpdateDocumentRequestDto {
  @ApiPropertyOptional({ example: 'Laudo neurológico (2026)' })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString({ message: 'Informe um título válido.' })
  @IsNotEmpty({ message: 'Informe o título.' })
  title?: string;

  @ApiPropertyOptional({
    example: 'Avaliação de novembro.',
    nullable: true,
  })
  @ValidateIf(
    (_object, value: unknown) => value !== undefined && value !== null,
  )
  @IsString({ message: 'Descrição inválida.' })
  description?: string | null;
}
