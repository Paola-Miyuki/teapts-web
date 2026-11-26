// Contrato da consulta de atendimentos (RFACT006). São classes, e não
// interfaces, para aparecerem no OpenAPI.

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  ActivityModality,
  VisitPlace,
} from '../../activities/enums/activity.enums';
import { PaginationResponseDto } from '../../common/pagination/pagination-response.dto';
import { Specialism } from '../../professionals/enums/specialism.enum';
import { Attendance } from '../enums/attendance.enum';

export class AppointmentPersonResponseDto {
  @ApiProperty({ example: 'c3d2e1f0-9a8b-4c7d-8e6f-5a4b3c2d1e0f' })
  id: string;

  @ApiProperty({ example: 'João Lima' })
  name: string;
}

/** Profissional autor (RN029). */
export class AppointmentAuthorResponseDto extends AppointmentPersonResponseDto {
  @ApiProperty({ enum: Specialism, example: Specialism.SpeechTherapist })
  specialism: Specialism;
}

export class AppointmentPtsResponseDto {
  @ApiProperty({ example: '3f2c9a1e-7b4d-4c8e-9f1a-2b3c4d5e6f70' })
  id: string;

  @ApiProperty({ example: 2 })
  version: number;
}

export class AppointmentActivityResponseDto {
  @ApiProperty({ example: '9c8b7a65-4d3e-4f21-8a9b-0c1d2e3f4a5b' })
  id: string;

  @ApiProperty({ example: 'Integração sensorial' })
  title: string;

  @ApiProperty({ enum: Specialism, example: Specialism.OccupationalTherapist })
  specialism: Specialism;
}

export class AppointmentSoapResponseDto {
  @ApiProperty({ example: 'Chegou tranquilo.' })
  subjective: string;

  @ApiProperty({ example: 'Manteve o circuito por 15 minutos.' })
  objective: string;

  @ApiProperty({ example: 'Avanço na tolerância tátil.' })
  assessment: string;

  @ApiProperty({ example: 'Repetir o circuito.' })
  plan: string;
}

/** Linha da lista: o atendimento original, com o selo de retificado. */
export class AppointmentListItemResponseDto {
  @ApiProperty({ example: '2b1a0f9e-8d7c-4b6a-9e5d-4c3b2a190807' })
  id: string;

  @ApiProperty({ example: '2026-12-03' })
  appointmentDate: string;

  @ApiProperty({ example: '14:00' })
  startTime: string;

  @ApiProperty({ type: String, nullable: true, example: '14:50' })
  endTime: string | null;

  @ApiProperty({ type: AppointmentPersonResponseDto })
  patient: AppointmentPersonResponseDto;

  @ApiProperty({ type: AppointmentPtsResponseDto })
  pts: AppointmentPtsResponseDto;

  @ApiProperty({ type: AppointmentActivityResponseDto })
  activity: AppointmentActivityResponseDto;

  @ApiProperty({ type: AppointmentAuthorResponseDto, nullable: true })
  author: AppointmentAuthorResponseDto | null;

  @ApiProperty({
    type: AppointmentPersonResponseDto,
    description:
      'Conta que registrou; sem autor, a autoria é dela (admin, RN029).',
  })
  registeredBy: AppointmentPersonResponseDto;

  @ApiProperty({ enum: ActivityModality, example: ActivityModality.InPerson })
  modality: ActivityModality;

  @ApiProperty({ enum: VisitPlace, nullable: true, example: null })
  visitPlace: VisitPlace | null;

  @ApiProperty({ enum: Attendance, example: Attendance.Done })
  attendance: Attendance;

  @ApiProperty({
    description: 'Tem retificação; o original continua guardado (RN020).',
    example: false,
  })
  rectified: boolean;
}

export class AppointmentListResponseDto {
  @ApiProperty({ type: [AppointmentListItemResponseDto] })
  data: AppointmentListItemResponseDto[];

  @ApiProperty({ type: PaginationResponseDto })
  pagination: PaginationResponseDto;
}

/** Um registro: o original ou uma retificação dele. */
export class AppointmentRecordResponseDto {
  @ApiProperty({ example: '2b1a0f9e-8d7c-4b6a-9e5d-4c3b2a190807' })
  id: string;

  @ApiProperty({ example: '2026-12-03' })
  appointmentDate: string;

  @ApiProperty({ example: '14:00' })
  startTime: string;

  @ApiProperty({ type: String, nullable: true, example: '14:50' })
  endTime: string | null;

  @ApiProperty({ enum: ActivityModality, example: ActivityModality.InPerson })
  modality: ActivityModality;

  @ApiProperty({ enum: VisitPlace, nullable: true, example: null })
  visitPlace: VisitPlace | null;

  @ApiProperty({ enum: Attendance, example: Attendance.Done })
  attendance: Attendance;

  @ApiProperty({ type: AppointmentAuthorResponseDto, nullable: true })
  author: AppointmentAuthorResponseDto | null;

  @ApiProperty({ type: AppointmentPersonResponseDto })
  registeredBy: AppointmentPersonResponseDto;

  @ApiProperty({ example: '2026-12-03T17:50:00.000Z' })
  createdAt: string;

  @ApiPropertyOptional({
    type: AppointmentSoapResponseDto,
    nullable: true,
    description:
      'Evolução completa, só para a equipe e o admin; nula na falta e na desmarcação.',
  })
  soap?: AppointmentSoapResponseDto | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Só para o paciente: o plano (P) do SOAP (RN028).',
  })
  plan?: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Motivo da falta ou da desmarcação.',
  })
  absenceReason: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Justificativa da retificação, só para a equipe e o admin.',
  })
  rectificationReason?: string | null;
}

export class AppointmentDetailsResponseDto extends AppointmentRecordResponseDto {
  @ApiProperty({ type: AppointmentPersonResponseDto })
  patient: AppointmentPersonResponseDto;

  @ApiProperty({ type: AppointmentPtsResponseDto })
  pts: AppointmentPtsResponseDto;

  @ApiProperty({ type: AppointmentActivityResponseDto })
  activity: AppointmentActivityResponseDto;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'O original, quando este registro é uma retificação.',
  })
  rectifiesAppointmentId: string | null;

  @ApiProperty({ example: false })
  rectified: boolean;

  @ApiProperty({
    type: [AppointmentRecordResponseDto],
    description: 'Retificações deste atendimento, da mais antiga à mais nova.',
  })
  rectifications: AppointmentRecordResponseDto[];
}
