// Este arquivo define o contato de suporte do paciente.
// Contato de suporte não concede tutela nem permissão clínica (RN017).

import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** Remove espaços externos; só espaços viram texto vazio (inválido). */
function trimText({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/** Remove espaços externos e trata o campo opcional vazio como ausente. */
function trimOptionalText({ value }: { value: unknown }): unknown {
  const text = trimText({ value });

  return text === '' ? undefined : text;
}

/** Contato de suporte do paciente; só o nome é obrigatório. */
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

  /** @example (11) 98765-4321 */
  @Transform(trimOptionalText)
  @IsOptional()
  @IsString({ message: 'Informe um telefone válido para o contato.' })
  phone?: string;
}
