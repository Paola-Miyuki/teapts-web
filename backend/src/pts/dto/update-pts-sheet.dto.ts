import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_MESSAGE = 'Informe uma data válida no formato yyyy-mm-dd.';

/** Ficha inteira do PTS ativo (RFPTS005): o corpo substitui a ficha. */
export class UpdatePtsSheetRequestDto {
  @ApiProperty({
    example: '2026-10-15',
    description: 'Data do estudo de caso.',
  })
  @Matches(DATE_ONLY, { message: DATE_MESSAGE })
  @IsISO8601({ strict: true }, { message: DATE_MESSAGE })
  caseStudyDate!: string;

  @ApiProperty({ example: 'Paciente com TEA nível 2, em acompanhamento.' })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'O diagnóstico em comum é obrigatório.' })
  diagnosisSummary!: string;

  @ApiPropertyOptional({ nullable: true, example: 'F84.0' })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  cid?: string | null;

  @ApiPropertyOptional({ nullable: true, minimum: 1, maximum: 3, example: 2 })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsInt()
  @Min(1)
  @Max(3)
  supportLevel?: number | null;

  @ApiPropertyOptional({ nullable: true, example: 'Boa memória visual.' })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  strengths?: string | null;

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    example: ['Comunicação', 'Autonomia'],
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @IsString({ each: true })
  priorityNeeds?: string[];

  @ApiProperty({ example: 'Mora com a mãe e a avó.' })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'A situação social é obrigatória.' })
  socialSituation!: string;

  @ApiPropertyOptional({ nullable: true, example: 'Renda familiar baixa.' })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  vulnerabilities?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'TDAH.' })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  comorbidities?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Sensível a ruídos.' })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  sensoryProfile?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Pranchas de comunicação.' })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  communicationMethod?: string | null;

  @ApiProperty({
    example: '2027-10-15',
    description: 'Próxima revisão (RN031).',
  })
  @Matches(DATE_ONLY, { message: DATE_MESSAGE })
  @IsISO8601({ strict: true }, { message: DATE_MESSAGE })
  nextReviewAt!: string;
}

/** Campos da ficha: só a equipe e o admin recebem (RN028). */
export class PtsSheetResponseDto {
  @ApiProperty({ example: '2026-10-15' })
  caseStudyDate!: string;

  @ApiProperty({ example: 'Paciente com TEA nível 2, em acompanhamento.' })
  diagnosisSummary!: string;

  @ApiProperty({ nullable: true, example: 'F84.0' })
  cid!: string | null;

  @ApiProperty({ nullable: true, example: 2 })
  supportLevel!: number | null;

  @ApiProperty({ nullable: true, example: 'Boa memória visual.' })
  strengths!: string | null;

  @ApiProperty({ type: String, isArray: true, example: ['Comunicação'] })
  priorityNeeds!: string[];

  @ApiProperty({ example: 'Mora com a mãe e a avó.' })
  socialSituation!: string;

  @ApiProperty({ nullable: true, example: 'Renda familiar baixa.' })
  vulnerabilities!: string | null;

  @ApiProperty({ nullable: true, example: 'TDAH.' })
  comorbidities!: string | null;

  @ApiProperty({ nullable: true, example: 'Sensível a ruídos.' })
  sensoryProfile!: string | null;

  @ApiProperty({ nullable: true, example: 'Pranchas de comunicação.' })
  communicationMethod!: string | null;

  @ApiProperty({ example: '2027-10-15' })
  nextReviewAt!: string;
}

export class UpdatePtsSheetResponseDto extends PtsSheetResponseDto {
  @ApiProperty({ example: 'uuid-do-pts' })
  id!: string;
}

/**
 * Ficha nas consultas do PTS: a equipe e o admin recebem tudo; o paciente
 * só recebe a próxima revisão (RN028).
 */
export class PtsSheetViewDto extends PartialType(
  OmitType(PtsSheetResponseDto, ['nextReviewAt'] as const),
) {
  @ApiProperty({ example: '2027-10-15' })
  nextReviewAt!: string;
}
