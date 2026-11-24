// Corpo do PATCH /patients/:id/clinical-data (RFPAC007).

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, ValidateIf } from 'class-validator';
import { trimText } from './support-contact.dto';

/** Corpo do `PATCH /patients/:id/clinical-data`. */
export class UpdateClinicalDataRequestDto {
  @ApiPropertyOptional({
    type: String,
    example: 'Parto a termo, sem intercorrências.',
  })
  @Transform(trimText)
  @ValidateIf((_, value) => value !== undefined)
  @IsString({ message: 'Informe antecedentes clínicos válidos.' })
  clinicalHistory?: string;

  @ApiPropertyOptional({
    type: String,
    example: 'Sem cirurgias anteriores.',
  })
  @Transform(trimText)
  @ValidateIf((_, value) => value !== undefined)
  @IsString({ message: 'Informe antecedentes cirúrgicos válidos.' })
  surgicalHistory?: string;

  @ApiPropertyOptional({
    type: String,
    example: 'Primo com TEA.',
  })
  @Transform(trimText)
  @ValidateIf((_, value) => value !== undefined)
  @IsString({ message: 'Informe antecedentes familiares válidos.' })
  familyHistory?: string;

  @ApiPropertyOptional({
    type: String,
    example: 'Sono regular.',
  })
  @Transform(trimText)
  @ValidateIf((_, value) => value !== undefined)
  @IsString({ message: 'Informe hábitos válidos.' })
  habits?: string;

  @ApiPropertyOptional({
    type: String,
    example: 'Desenvolvimento motor dentro do esperado.',
  })
  @Transform(trimText)
  @ValidateIf((_, value) => value !== undefined)
  @IsString({ message: 'Informe marcos do desenvolvimento válidos.' })
  developmentalMilestones?: string;

  @ApiPropertyOptional({
    type: String,
    example: 'Alergia a amoxicilina.',
  })
  @Transform(trimText)
  @ValidateIf((_, value) => value !== undefined)
  @IsString({ message: 'Informe alergias e restrições válidas.' })
  allergies?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean({ message: 'Informe se não há alergias conhecidas.' })
  noKnownAllergies?: boolean;
}
