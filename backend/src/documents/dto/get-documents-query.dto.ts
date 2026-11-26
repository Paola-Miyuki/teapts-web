// Este arquivo define e valida os parâmetros da consulta de documentos (RFDOC003).
// Os erros saem `{ status: 'ERROR', message: 'Parâmetro inválido: <param>' }`.

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  type ValidationOptions,
} from 'class-validator';
import {
  invalidParameter,
  PaginationQueryDto,
} from '../../common/pagination/pagination-query.dto';
import { DocumentCategory } from '../enums/document-category.enum';

const CATEGORIES = Object.values(DocumentCategory);

function invalidEach(parameter: string): ValidationOptions {
  return { ...invalidParameter(parameter), each: true };
}

/** Texto opcional: espaços externos saem, e vazio equivale a sem filtro. */
function toOptionalText({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() || undefined : value;
}

/** Aceita `category=a,b` ou `category=a&category=b`; vazio equivale a sem filtro. */
function toCategoryList({ value }: { value: unknown }): unknown {
  if (value === undefined) {
    return undefined;
  }

  const categories = (Array.isArray(value) ? value : [value])
    .flatMap((item) => (typeof item === 'string' ? item.split(',') : [item]))
    .map((item) => (typeof item === 'string' ? item.trim() : item))
    .filter((item) => item !== '');

  return categories.length > 0 ? [...new Set(categories)] : undefined;
}

/** Query do `GET /patients/:id/documents`. */
export class GetDocumentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Parte do título, sem diferenciar maiúsculas; `%`, `_` e `\\` contam como texto; vazio equivale a sem busca.',
    example: 'laudo',
  })
  @Transform(toOptionalText)
  @IsOptional()
  @IsString(invalidParameter('q'))
  q?: string;

  @ApiPropertyOptional({
    description:
      'Categorias, separadas por vírgula ou repetindo o parâmetro. Os termos são `tcle` e `image_authorization`.',
    enum: CATEGORIES,
    isArray: true,
    example: ['medical_report'],
  })
  @Transform(toCategoryList)
  @IsOptional()
  @IsIn(CATEGORIES, invalidEach('category'))
  category?: DocumentCategory[];
}
