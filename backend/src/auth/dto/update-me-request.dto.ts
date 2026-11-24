// Este arquivo define o corpo do PATCH /me.

import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Validate,
  ValidateIf,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { ApiHideProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from '../../accounts/enums/gender.enum';
import { Sex } from '../../accounts/enums/sex.enum';
import { isValidBirthDate, onlyDigits } from '../sign-up-fields';

const nameTransform = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const emailTransform = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** Texto opcional que pode ser limpo: vazio vira null. */
const nullableTextTransform = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

/** Telefone só com dígitos; vazio vira null. */
const phoneTransform = ({ value }: { value: unknown }) =>
  typeof value === 'string'
    ? value.trim() === ''
      ? null
      : onlyDigits(value)
    : value;

@ValidatorConstraint({ name: 'birthDate', async: false })
class BirthDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isValidBirthDate(value);
  }

  defaultMessage(): string {
    return 'Informe uma data de nascimento válida.';
  }
}

const ACCOUNT_FIELDS = [
  'role',
  'name',
  'email',
  'socialName',
  'birthDate',
  'sex',
  'gender',
  'phone',
] as const;

@ValidatorConstraint({ name: 'atLeastOneAccountField', async: false })
class AtLeastOneAccountFieldConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const request = args.object as UpdateMeRequestDto;

    return ACCOUNT_FIELDS.some((field) => request[field] !== undefined);
  }

  defaultMessage(): string {
    return 'Informe ao menos um dado da conta.';
  }
}

/** Corpo do `PATCH /me`. */
export class UpdateMeRequestDto {
  @ApiHideProperty()
  @Validate(AtLeastOneAccountFieldConstraint)
  private readonly accountFields?: unknown;

  @ApiPropertyOptional({ example: 'Kaio Felipe' })
  @ValidateIf((_, value) => value !== undefined)
  @IsString({ message: 'Informe um nome válido.' })
  @IsNotEmpty({ message: 'Informe um nome válido.' })
  @Matches(/\S/, { message: 'Informe um nome válido.' })
  @Transform(nameTransform)
  name?: string;
  @ApiPropertyOptional({ example: 'kaio.felipe@example.com' })
  @ValidateIf((_, value) => value !== undefined)
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @Transform(emailTransform)
  email?: string;

  /** null ou vazio apaga o nome social. */
  @ApiPropertyOptional({ type: String, nullable: true, example: null })
  @Transform(nullableTextTransform)
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString({ message: 'Informe um nome social válido.' })
  socialName?: string | null;

  @ApiPropertyOptional({ example: '1990-05-20' })
  @ValidateIf((_, value) => value !== undefined)
  @Validate(BirthDateConstraint)
  birthDate?: string;

  @ApiPropertyOptional({ enum: Sex })
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(Object.values(Sex), { message: 'Informe um sexo válido.' })
  sex?: Sex;

  /** null apaga o gênero. */
  @ApiPropertyOptional({ enum: Gender, nullable: true })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsIn(Object.values(Gender), { message: 'Informe um gênero válido.' })
  gender?: Gender | null;

  /** Com DDD, com ou sem máscara; null ou vazio apaga o telefone. */
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '(11) 98765-4321',
  })
  @Transform(phoneTransform)
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @Matches(/^\d{10,11}$/, { message: 'Informe um telefone válido, com DDD.' })
  phone?: string | null;

  /**
   * Mantido fora da documentação para que a regra de negócio possa devolver
   * 403, em vez de o whitelist global removê-lo silenciosamente.
   */
  @ApiHideProperty()
  @IsOptional()
  role?: unknown;
}
