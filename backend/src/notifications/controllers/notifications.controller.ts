import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import type { AccountContext } from '../../accounts/services/accounts.service';
import { CurrentAccount } from '../../auth/decorators/current-account.decorator';
import { AuthGuard } from '../../auth/guards/auth.guard';
import {
  ErrorResponseDto,
  UnauthorizedResponseDto,
} from '../../common/swagger/error-response.dto';
import { GetNotificationsQueryDto } from '../dto/get-notifications-query.dto';
import {
  GetNotificationsResponseDto,
  NotificationResponseDto,
  ReadAllResponseDto,
  UnreadCountResponseDto,
} from '../dto/notification-response.dto';
import { NotificationsService } from '../services/notifications.service';

const parseId = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException({
      status: 'VALIDATION_ERROR',
      message: 'Parâmetro inválido: id',
    }),
});

@ApiTags('notifications')
@ApiCookieAuth()
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: UnauthorizedResponseDto })
@UseGuards(AuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista as notificações da conta (RFNOT002)',
    description:
      'Das mais recentes às mais antigas, paginadas. O admin não recebe notificações: a lista vem vazia.',
  })
  @ApiOkResponse({ type: GetNotificationsResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async findNotifications(
    @Query() query: GetNotificationsQueryDto,
    @CurrentAccount() account: AccountContext,
  ): Promise<GetNotificationsResponseDto> {
    return this.notificationsService.findNotifications(query, account);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Quantidade de não lidas da conta (RFNOT002)' })
  @ApiOkResponse({ type: UnreadCountResponseDto })
  async countUnread(
    @CurrentAccount() account: AccountContext,
  ): Promise<UnreadCountResponseDto> {
    return this.notificationsService.countUnread(account);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marca todas da conta como lidas (RFNOT002)' })
  @ApiOkResponse({ type: ReadAllResponseDto })
  async markAllAsRead(
    @CurrentAccount() account: AccountContext,
  ): Promise<ReadAllResponseDto> {
    return this.notificationsService.markAllAsRead(account);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Marca uma notificação como lida (RFNOT002)',
    description: 'A data de leitura da já lida não muda.',
  })
  @ApiOkResponse({ type: NotificationResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    examples: {
      NOTIFICATION_NOT_FOUND: {
        summary: 'Notificação inexistente ou de outra conta',
        value: {
          status: 'NOTIFICATION_NOT_FOUND',
          message: 'Notificação não encontrada.',
        },
      },
    },
  })
  async markAsRead(
    @Param('id', parseId) id: string,
    @CurrentAccount() account: AccountContext,
  ): Promise<NotificationResponseDto> {
    return this.notificationsService.markAsRead(id, account);
  }
}
