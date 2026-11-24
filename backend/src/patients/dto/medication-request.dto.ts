// Corpo usado para cadastrar e editar medicação do paciente (RFPAC007).

import {
  ApiHideProperty,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Validate,
  type ValidationArguments,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { trimOptionalText, trimText } from './support-contact.dto';

/** Valida uma data real no formato YYYY-MM-DD. */
function isValidMedicationDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

@ValidatorConstraint({ name: 'medicationDate', async: false })
class MedicationDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isValidMedicationDate(value);
  }

  defaultMessage(): string {
    return 'Informe uma data válida no formato YYYY-MM-DD.';
  }
}

@ValidatorConstraint({ name: 'medicationDateRange', async: false })
class MedicationDateRangeConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const request = args.object as MedicationRequestDto;

    if (request.endDate === undefined) {
      return true;
    }

    if (
      !isValidMedicationDate(request.startDate) ||
      !isValidMedicationDate(request.endDate)
    ) {
      return true;
    }

    return request.endDate >= request.startDate;
  }

  defaultMessage(): string {
    return 'A data de fim não pode ser anterior à data de início.';
  }
}

/** Corpo do cadastro e da edição de medicação. */
export class MedicationRequestDto {
  @ApiProperty({ example: 'Risperidona' })
  @Transform(trimText)
  @IsString({ message: 'Informe o medicamento.' })
  @IsNotEmpty({ message: 'Informe o medicamento.' })
  drugName: string;

  @ApiProperty({ example: '0,5 mg' })
  @Transform(trimText)
  @IsString({ message: 'Informe a dose.' })
  @IsNotEmpty({ message: 'Informe a dose.' })
  dose: string;

  @ApiProperty({ example: '1x ao dia, à noite' })
  @Transform(trimText)
  @IsString({ message: 'Informe a frequência.' })
  @IsNotEmpty({ message: 'Informe a frequência.' })
  frequency: string;

  @ApiPropertyOptional({ example: 'Dra. Maria Silva' })
  @Transform(trimOptionalText)
  @IsOptional()
  @IsString({ message: 'Informe um prescritor válido.' })
  prescriber?: string;

  @ApiPropertyOptional({ example: 'Controle de irritabilidade' })
  @Transform(trimOptionalText)
  @IsOptional()
  @IsString({ message: 'Informe um motivo válido.' })
  reason?: string;

  @ApiProperty({ example: '2026-11-24' })
  @Transform(trimText)
  @IsString({ message: 'Informe a data de início.' })
  @IsNotEmpty({ message: 'Informe a data de início.' })
  @Validate(MedicationDateConstraint)
  startDate: string;

  @ApiPropertyOptional({ example: '2026-12-24' })
  @Transform(trimOptionalText)
  @IsOptional()
  @IsString({ message: 'Informe uma data de fim válida.' })
  @Validate(MedicationDateConstraint)
  endDate?: string;

  @ApiHideProperty()
  @Validate(MedicationDateRangeConstraint)
  private readonly dateRange?: unknown;
}
