import { ApiProperty } from '@nestjs/swagger';

import { PaginationResponseDto } from '../../common/pagination/pagination-response.dto';
import { NotificationType } from '../enums/notification-type.enum';

export class NotificationResponseDto {
  @ApiProperty({ example: '0f1e2d3c-4b5a-4968-8776-655443322110' })
  id!: string;

  @ApiProperty({
    enum: NotificationType,
    example: NotificationType.ReviewWindow,
  })
  type!: NotificationType;

  @ApiProperty({
    example:
      'A reavaliação do PTS de João Pedro Santos vence em 30 dias (18/12/2026).',
  })
  message!: string;

  @ApiProperty({ example: '3f2c9a1e-7b4d-4c8e-9f1a-2b3c4d5e6f70' })
  ptsId!: string;

  @ApiProperty({ example: '2026-11-18T09:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  readAt!: string | null;
}

export class GetNotificationsResponseDto {
  @ApiProperty({ type: NotificationResponseDto, isArray: true })
  data!: NotificationResponseDto[];

  @ApiProperty({ type: PaginationResponseDto })
  pagination!: PaginationResponseDto;

  @ApiProperty({ description: 'Não lidas da conta, sem filtro.', example: 1 })
  unreadCount!: number;
}

export class UnreadCountResponseDto {
  @ApiProperty({ example: 1 })
  unreadCount!: number;
}

export class ReadAllResponseDto {
  @ApiProperty({ example: 'OK' })
  status!: 'OK';
}
