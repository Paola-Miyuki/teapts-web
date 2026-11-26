// Este arquivo define e valida o corpo do `PATCH` de um contato de suporte
// (RFPAC003). Os campos que não vêm ficam como estão; `null` limpa a
// descrição, o e-mail ou o telefone. A regra do contato inteiro (e-mail ou
// telefone, e telefone na emergência) vale para o contato resultante e é
// aplicada pelo service.

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Validate,
  ValidateIf,
} from 'class-validator';
import {
  INVALID_SUPPORT_CONTACT_PHONE,
  SupportContactPhoneConstraint,
  trimOptionalText,
  trimText,
} from './support-contact.dto';

/** Corpo do `PATCH /patients/:patientId/support-contacts/:contactId`. */
export class UpdateSupportContactRequestDto {
  @ApiPropertyOptional({ example: 'Maria Martins' })
  @ValidateIf((_, value) => value !== undefined)
  @Transform(trimText)
  @IsString({ message: 'Informe o nome do contato.' })
  @IsNotEmpty({ message: 'Informe o nome do contato.' })
  name?: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Avó' })
  @Transform(trimOptionalText)
  @IsOptional()
  @IsString({ message: 'Informe uma descrição válida para o contato.' })
  description?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'maria@exemplo.com',
  })
  @Transform(trimOptionalText)
  @IsOptional()
  @IsEmail({}, { message: 'Informe um e-mail válido para o contato.' })
  email?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '(11) 98765-4321',
  })
  @Transform(trimOptionalText)
  @IsOptional()
  @IsString({ message: INVALID_SUPPORT_CONTACT_PHONE })
  @Validate(SupportContactPhoneConstraint, {
    message: INVALID_SUPPORT_CONTACT_PHONE,
  })
  phone?: string | null;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean({ message: 'Informe se o contato é de emergência.' })
  isEmergency?: boolean;
}
