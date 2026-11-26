import { ApiProperty } from '@nestjs/swagger';

import { Specialism } from '../../professionals/enums/specialism.enum';
import {
  ActivityExecutor,
  ActivityModality,
  ActivityState,
  ActivityType,
  VisitPlace,
} from '../enums/activity.enums';
import { ActivityFrequencyDto } from './create-activity.dto';
import { PaginationResponseDto } from '../../common/pagination/pagination-response.dto';

export class ActivityResponseDto {
  @ApiProperty({ example: '9c8b7a65-4d3e-4f21-8a9b-0c1d2e3f4a5b' })
  id!: string;

  @ApiProperty({ example: 'Integração sensorial' })
  title!: string;

  @ApiProperty({
    example: 'Circuito sensorial com estímulo tátil e vestibular.',
  })
  description!: string;

  @ApiProperty({ enum: ActivityType })
  type!: ActivityType;

  @ApiProperty({ enum: Specialism })
  specialism!: Specialism;

  @ApiProperty({ type: ActivityFrequencyDto })
  frequency!: ActivityFrequencyDto;

  @ApiProperty({ enum: ActivityModality })
  modality!: ActivityModality;

  @ApiProperty({ enum: VisitPlace, nullable: true, example: null })
  visitPlace!: VisitPlace | null;

  @ApiProperty({ enum: ActivityExecutor })
  executor!: ActivityExecutor;

  @ApiProperty({ type: String, isArray: true, example: [] })
  executorProfessionalIds!: string[];

  @ApiProperty({ type: String, nullable: true, example: null })
  goalId!: string | null;

  @ApiProperty({
    type: String,
    isArray: true,
    example: [],
    description: 'Vazio para o paciente, que não vê os documentos (RN028).',
  })
  documentIds!: string[];

  @ApiProperty({ enum: ActivityState, example: ActivityState.Suggested })
  status!: ActivityState;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description:
      'Profissional autor (RN029); nulo quando o admin cria sem atribuir.',
  })
  authorProfessionalId!: string | null;

  @ApiProperty({ example: '2026-12-01T13:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  updatedAt!: string | null;
}

export class GetActivitiesResponseDto {
  @ApiProperty({ type: ActivityResponseDto, isArray: true })
  data!: ActivityResponseDto[];

  @ApiProperty({ type: PaginationResponseDto })
  pagination!: PaginationResponseDto;
}

export class ActivityDetailsResponseDto extends ActivityResponseDto {
  @ApiProperty({
    type: 'object',
    nullable: true,
    properties: {
      id: { type: 'string', format: 'uuid' },
      title: { type: 'string' },
    },
  })
  goal!: { id: string; title: string } | null;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        title: { type: 'string' },
      },
    },
  })
  documents!: { id: string; title: string }[];

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    example: 0,
    description: 'Atendimentos registrados; a retificação não conta.',
  })
  appointmentsCount!: number;
}
