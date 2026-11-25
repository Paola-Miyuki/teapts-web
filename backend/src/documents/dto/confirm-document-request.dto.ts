// Este arquivo define e valida o corpo da confirmação do documento (RFDOC002).
// Os erros saem `{ status: 'VALIDATION_ERROR', message }` pelo pipe global.

import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  registerDecorator,
  type ValidationOptions,
} from 'class-validator';
import { DocumentCategory } from '../enums/document-category.enum';

/** Aceita no máximo um dos dois emissores (`CHK_document_issuer`). */
function AtMostOneIssuer(options?: ValidationOptions) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'atMostOneIssuer',
      target: target.constructor,
      propertyName,
      options,
      validator: {
        validate: (_value: unknown, args) => {
          const { issuerAccountId, issuerName } = (args?.object ?? {}) as {
            issuerAccountId?: unknown;
            issuerName?: unknown;
          };

          return issuerAccountId === undefined || issuerName === undefined;
        },
      },
    });
}

/** Corpo do `POST /patients/:id/documents`. */
export class ConfirmDocumentRequestDto {
  /**
   * Chave devolvida pela URL de envio.
   * @example 7c1f0f0e-1d2b-4b43-8a6e-0f2b6c1d9e11/a1b2c3d4-laudo.pdf
   */
  @IsString({ message: 'Informe o arquivo enviado.' })
  @IsNotEmpty({ message: 'Informe o arquivo enviado.' })
  fileKey: string;

  /** @example Laudo neurológico */
  @IsString({ message: 'Informe o título.' })
  @IsNotEmpty({ message: 'Informe o título.' })
  title: string;

  @IsEnum(DocumentCategory, { message: 'Escolha uma categoria válida.' })
  category: DocumentCategory;

  /**
   * Data de emissão, `YYYY-MM-DD`.
   * @example 2026-11-20
   */
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, {
    message: 'Informe a data de emissão no formato AAAA-MM-DD.',
  })
  issueDate?: string;

  /** Conta do profissional que emitiu; não vale junto com `issuerName`. */
  @IsOptional()
  @IsUUID(undefined, { message: 'Emissor inválido.' })
  issuerAccountId?: string;

  /**
   * Emissor de fora (nome, registro e instituição); não vale junto com
   * `issuerAccountId`.
   * @example Dra. Marta Reis, CRM-PR 12345, Hospital Pequeno Príncipe
   */
  @AtMostOneIssuer({ message: 'Informe só um emissor.' })
  @IsOptional()
  @IsString({ message: 'Informe o emissor.' })
  @IsNotEmpty({ message: 'Informe o emissor.' })
  issuerName?: string;

  @IsOptional()
  @IsString({ message: 'Descrição inválida.' })
  description?: string;
}
