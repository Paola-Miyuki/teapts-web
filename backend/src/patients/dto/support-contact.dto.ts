// Este arquivo define o contato de suporte do paciente e as regras dele, as
// mesmas no cadastro do paciente (RFPAC001) e na edição contato a contato
// (RFPAC003). Contato de suporte não concede tutela nem permissão clínica
// (RN017).

import { ApiHideProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Validate,
  type ValidationArguments,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

/** Telefone com DDD: 10 ou 11 dígitos, com ou sem máscara. */
export const SUPPORT_CONTACT_PHONE = /^\D*(?:\d\D*){10,11}$/;

export const INVALID_SUPPORT_CONTACT_PHONE =
  'Informe um telefone válido para o contato.';

/** Remove espaços externos; só espaços viram texto vazio (inválido). */
export function trimText({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/** Remove espaços externos e trata o campo opcional vazio como ausente. */
export function trimOptionalText({ value }: { value: unknown }): unknown {
  const text = trimText({ value });

  return text === '' ? undefined : text;
}

/** Meios de contato e marca de emergência, já normalizados. */
export type SupportContactChannels = {
  email?: string | null;
  phone?: string | null;
  isEmergency?: boolean;
};

/**
 * Diz o que falta no contato (RFPAC001.E03): e-mail ou telefone, e telefone
 * no contato de emergência.
 *
 * @returns a mensagem do erro, ou `undefined` quando o contato é válido
 */
export function supportContactChannelError(
  contact: SupportContactChannels,
): string | undefined {
  if (!contact.email && !contact.phone) {
    return 'Informe o e-mail ou o telefone do contato.';
  }

  if (contact.isEmergency === true && !contact.phone) {
    return 'Informe o telefone do contato de emergência.';
  }

  return undefined;
}

@ValidatorConstraint({ name: 'supportContactChannels', async: false })
class SupportContactChannelsConstraint implements ValidatorConstraintInterface {
  private message = '';

  validate(_value: unknown, args: ValidationArguments): boolean {
    this.message =
      supportContactChannelError(args.object as SupportContactChannels) ?? '';

    return this.message === '';
  }

  defaultMessage(): string {
    return this.message;
  }
}

/** Contato de suporte do paciente; o nome e um meio de contato são obrigatórios. */
export class SupportContactDto {
  /** @example Maria Martins */
  @Transform(trimText)
  @IsString({ message: 'Informe o nome do contato.' })
  @IsNotEmpty({ message: 'Informe o nome do contato.' })
  name: string;

  /** @example Mãe */
  @Transform(trimOptionalText)
  @IsOptional()
  @IsString({ message: 'Informe uma descrição válida para o contato.' })
  description?: string;

  /** @example maria@exemplo.com */
  @Transform(trimOptionalText)
  @IsOptional()
  @IsEmail({}, { message: 'Informe um e-mail válido para o contato.' })
  email?: string;

  /** Com DDD; obrigatório no contato de emergência. @example (11) 98765-4321 */
  @Transform(trimOptionalText)
  @IsOptional()
  @IsString({ message: INVALID_SUPPORT_CONTACT_PHONE })
  @Matches(SUPPORT_CONTACT_PHONE, { message: INVALID_SUPPORT_CONTACT_PHONE })
  phone?: string;

  /** Contato de emergência; padrão `false`. @example false */
  @IsOptional()
  @IsBoolean({ message: 'Informe se o contato é de emergência.' })
  isEmergency?: boolean;

  /** Valida o e-mail ou telefone e o telefone de emergência, depois dos campos. */
  @ApiHideProperty()
  @Validate(SupportContactChannelsConstraint)
  private readonly channels?: unknown;
}
