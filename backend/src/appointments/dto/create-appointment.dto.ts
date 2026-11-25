import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateIf,
} from 'class-validator';

import {
  ActivityModality,
  VisitPlace,
} from '../../activities/enums/activity.enums';
import { Attendance } from '../enums/attendance.enum';

const DATE_MESSAGE = 'Informe a data do atendimento no formato yyyy-mm-dd.';
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const isDone = (dto: CreateAppointmentRequestDto) =>
  dto.attendance === Attendance.Done;

const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

export class CreateAppointmentRequestDto {
  @ApiProperty({
    description:
      'Dia do atendimento (yyyy-mm-dd, horário de Brasília). Só a desmarcação aceita data futura.',
    example: '2026-12-03',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: DATE_MESSAGE })
  @IsISO8601({ strict: true }, { message: DATE_MESSAGE })
  appointmentDate!: string;

  @ApiProperty({ description: 'Hora de início (HH:mm).', example: '14:00' })
  @Matches(TIME_PATTERN, {
    message: 'Informe a hora de início no formato HH:mm.',
  })
  startTime!: string;

  @ApiPropertyOptional({
    description:
      'Hora de término (HH:mm). Obrigatória no realizado, depois do início.',
    example: '14:45',
  })
  @ValidateIf(
    (dto: CreateAppointmentRequestDto) =>
      isDone(dto) || dto.endTime !== undefined,
  )
  @Matches(TIME_PATTERN, {
    message: 'Informe a hora de término no formato HH:mm.',
  })
  endTime?: string;

  @ApiProperty({
    enum: ActivityModality,
    description: 'Modalidade da sessão.',
    example: ActivityModality.InPerson,
  })
  @IsEnum(ActivityModality, { message: 'Informe a modalidade.' })
  modality!: ActivityModality;

  @ApiPropertyOptional({
    enum: VisitPlace,
    description: 'Obrigatório na visita externa.',
  })
  @ValidateIf(
    (dto: CreateAppointmentRequestDto) =>
      dto.visitPlace !== undefined ||
      dto.modality === ActivityModality.ExternalVisit,
  )
  @IsEnum(VisitPlace, { message: 'Informe o local da visita.' })
  visitPlace?: VisitPlace;

  @ApiProperty({
    enum: Attendance,
    description:
      'Comparecimento: realizado (done), falta (missed) ou desmarcado (cancelled).',
    example: Attendance.Done,
  })
  @IsEnum(Attendance, { message: 'Informe o comparecimento.' })
  attendance!: Attendance;

  @ApiPropertyOptional({
    description:
      'Obrigatório no realizado; a falta e a desmarcação não têm SOAP.',
    example: 'Chegou tranquilo; a mãe relatou boa semana.',
  })
  @Trim()
  @ValidateIf(isDone)
  @IsString({ message: 'Preencha o subjetivo do SOAP.' })
  @IsNotEmpty({ message: 'Preencha o subjetivo do SOAP.' })
  soapSubjective?: string;

  @ApiPropertyOptional({
    description:
      'Obrigatório no realizado; a falta e a desmarcação não têm SOAP.',
    example: 'Manteve o circuito por 15 minutos.',
  })
  @Trim()
  @ValidateIf(isDone)
  @IsString({ message: 'Preencha o objetivo do SOAP.' })
  @IsNotEmpty({ message: 'Preencha o objetivo do SOAP.' })
  soapObjective?: string;

  @ApiPropertyOptional({
    description:
      'Obrigatório no realizado; a falta e a desmarcação não têm SOAP.',
    example: 'Avanço na tolerância a estímulos táteis.',
  })
  @Trim()
  @ValidateIf(isDone)
  @IsString({ message: 'Preencha a avaliação do SOAP.' })
  @IsNotEmpty({ message: 'Preencha a avaliação do SOAP.' })
  soapAssessment?: string;

  @ApiPropertyOptional({
    description:
      'Obrigatório no realizado; a falta e a desmarcação não têm SOAP.',
    example: 'Repetir o circuito e orientar a família sobre a rotina.',
  })
  @Trim()
  @ValidateIf(isDone)
  @IsString({ message: 'Preencha o plano do SOAP.' })
  @IsNotEmpty({ message: 'Preencha o plano do SOAP.' })
  soapPlan?: string;

  @ApiPropertyOptional({
    description:
      'Motivo opcional da falta ou da desmarcação; no realizado não é guardado.',
    example: 'A criança estava doente.',
  })
  @IsOptional()
  @IsString({ message: 'O motivo deve ser um texto.' })
  absenceReason?: string;

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
