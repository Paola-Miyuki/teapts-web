// Este arquivo define o corpo do PATCH /me.

import { Transform } from 'class-transformer';
import {
  IsEmail,
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

const nameTransform = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const emailTransform = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

@ValidatorConstraint({ name: 'atLeastOneAccountField', async: false })
class AtLeastOneAccountFieldConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const request = args.object as UpdateMeRequestDto;

    return (
      request.role !== undefined ||
      request.name !== undefined ||
      request.email !== undefined
    );
  }

  defaultMessage(): string {
    return 'Informe nome ou e-mail.';
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

  /**
   * Mantido fora da documentação para que a regra de negócio possa devolver
   * 403, em vez de o whitelist global removê-lo silenciosamente.
   */
  @ApiHideProperty()
  @IsOptional()
  role?: unknown;
}
