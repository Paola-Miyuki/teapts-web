// Este arquivo descreve a resposta de GET /pts/:id/timeline.

import { ApiProperty } from '@nestjs/swagger';

import { PaginationResponseDto } from '../../common/pagination/pagination-response.dto';
import { TimelineRecordTarget } from '../enums/timeline-record-target.enum';
import { TimelineRecordType } from '../enums/timeline-record-type.enum';

/** Pessoa ligada ao evento: a conta que executou ou o profissional atribuído. */
export class TimelinePersonDto {
  @ApiProperty({ example: 'c3a1b2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d' })
  id: string;

  @ApiProperty({
    example: 'João Lima',
    description: 'Nome exibido: o nome social, se houver; senão o nome.',
  })
  name: string;
}

/** Evento da timeline do PTS (RFTL001). */
export class TimelineRecordDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: TimelineRecordType, example: 'activity_approved' })
  type: TimelineRecordType;

  @ApiProperty({
    enum: TimelineRecordTarget,
    example: 'activity',
    description:
      'Tipo do alvo; é o "Tipo do evento" da tela. Eventos de meta e da ficha entram como `pts`.',
  })
  targetType: TimelineRecordTarget;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description:
      'Id do registro alvo (atividade, atendimento, membro, documento ou o próprio PTS). Nulo para o paciente nos eventos de documento (RN028).',
  })
  targetId: string | null;

  @ApiProperty({
    example: 'João Lima aprovou a atividade Integração sensorial',
  })
  description: string;

  @ApiProperty({ example: '2026-11-12T14:45:00.000Z' })
  happenedAt: string;

  @ApiProperty({
    type: TimelinePersonDto,
    description: 'Conta que executou a ação (RN029).',
  })
  author: TimelinePersonDto;

  @ApiProperty({
    type: TimelinePersonDto,
    nullable: true,
    description:
      'Profissional atribuído quando o admin age em nome dele (RN029); nulo quando o próprio profissional age ou o admin não atribui.',
  })
  assignedTo: TimelinePersonDto | null;
}

export class GetTimelineResponseDto {
  @ApiProperty({ type: [TimelineRecordDto] })
  data: TimelineRecordDto[];

  @ApiProperty({ type: PaginationResponseDto })
  pagination: PaginationResponseDto;
}
