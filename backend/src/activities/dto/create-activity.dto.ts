import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

import { Specialism } from '../../professionals/enums/specialism.enum';
import {
  ActivityExecutor,
  ActivityModality,
  ActivityPeriod,
  ActivityType,
  VisitPlace,
} from '../enums/activity.enums';

const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

export class ActivityFrequencyDto {
  @ApiProperty({ type: 'integer', minimum: 1, example: 1 })
  quantity!: number;

  @ApiProperty({ enum: ActivityPeriod, example: ActivityPeriod.Weekly })
  period!: ActivityPeriod;

  @ApiProperty({ type: 'integer', minimum: 1, example: 45 })
  durationMinutes!: number;
}

export class CreateActivityRequestDto {
  @ApiProperty({ example: 'Integração sensorial' })
  @Trim()
  @IsString({ message: 'O título da atividade é obrigatório.' })
  @IsNotEmpty({ message: 'O título da atividade é obrigatório.' })
  title!: string;

  @ApiProperty({
    example: 'Circuito sensorial com estímulo tátil e vestibular.',
  })
  @Trim()
  @IsString({ message: 'A descrição da atividade é obrigatória.' })
  @IsNotEmpty({ message: 'A descrição da atividade é obrigatória.' })
  description!: string;

  @ApiProperty({ enum: ActivityType, example: ActivityType.IndividualSession })
  @IsEnum(ActivityType, { message: 'Informe o tipo da atividade.' })
  type!: ActivityType;

  @ApiProperty({ enum: Specialism, example: Specialism.OccupationalTherapist })
  @IsEnum(Specialism, { message: 'Informe a especialidade.' })
  specialism!: Specialism;

  // Validada no serviço: a frequência inválida responde 422, não 400.
  @ApiProperty({ type: ActivityFrequencyDto })
  @Allow()
  frequency!: ActivityFrequencyDto;

  @ApiProperty({ enum: ActivityModality, example: ActivityModality.InPerson })
  @IsEnum(ActivityModality, { message: 'Informe a modalidade.' })
  modality!: ActivityModality;

  @ApiPropertyOptional({
    enum: VisitPlace,
    description: 'Obrigatório na visita externa.',
  })
  @ValidateIf(
    (dto: CreateActivityRequestDto) =>
      dto.visitPlace !== undefined ||
      dto.modality === ActivityModality.ExternalVisit,
  )
  @IsEnum(VisitPlace, { message: 'Informe o local da visita.' })
  visitPlace?: VisitPlace;

  @ApiPropertyOptional({
    enum: ActivityExecutor,
    default: ActivityExecutor.Team,
  })
  @IsOptional()
  @IsEnum(ActivityExecutor, { message: 'Informe quem executa.' })
  executor?: ActivityExecutor;

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    format: 'uuid',
    description: 'Membros da equipe (co-terapia); vazio, vale o autor.',
  })
  @IsOptional()
  @IsArray({ message: 'executorProfessionalIds deve ser uma lista.' })
  @IsUUID(undefined, {
    each: true,
    message: 'executorProfessionalIds deve ter UUIDs válidos.',
  })
  executorProfessionalIds?: string[];

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Meta do mesmo PTS (RFPTS012).',
  })
  @IsOptional()
  @IsUUID(undefined, { message: 'goalId deve ser um UUID válido.' })
  goalId?: string;

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    format: 'uuid',
    description: 'Documentos do mesmo paciente (RN013).',
  })
  @IsOptional()
  @IsArray({ message: 'documentIds deve ser uma lista.' })
  @IsUUID(undefined, {
    each: true,
    message: 'documentIds deve ter UUIDs válidos.',
  })
  documentIds?: string[];

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Profissional da equipe a quem o admin atribui a autoria (RN029). Ignorado para o profissional, que é sempre o autor.',
  })
  @IsOptional()
  @IsUUID(undefined, {
    message: 'authorProfessionalId deve ser um UUID válido.',
  })
  authorProfessionalId?: string;
}
