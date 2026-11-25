import {
  BadRequestException,
  Body,
  Controller,
  Get,
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
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import type { AccountContext } from '../../accounts/services/accounts.service';
import { activityNotFound } from '../../activities/activities.errors';
import { CurrentAccount } from '../../auth/decorators/current-account.decorator';
import { AuthGuard } from '../../auth/guards/auth.guard';
import {
  ErrorResponseDto,
  UnauthorizedResponseDto,
} from '../../common/swagger/error-response.dto';
import { ptsNotFound } from '../../pts/pts.errors';
import { errors } from '../../pts/swagger-errors';
import {
  appointmentNotFound,
  appointmentsViewForbidden,
  rectifyForbidden,
} from '../appointments.errors';
import {
  AppointmentDetailsResponseDto,
  AppointmentListResponseDto,
} from '../dto/appointment-details-response.dto';
import { GetAppointmentsQueryDto } from '../dto/get-appointments-query.dto';
import {
  RectifyAppointmentRequestDto,
  RectifyAppointmentResponseDto,
} from '../dto/rectify-appointment.dto';
import { AppointmentsService } from '../services/appointments.service';

const parseAppointmentId = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException({
      status: 'VALIDATION_ERROR',
      message: 'Parâmetro inválido: id',
    }),
});

const INVALID_ID = {
  summary: 'id do atendimento que não é UUID',
  value: { status: 'VALIDATION_ERROR', message: 'Parâmetro inválido: id' },
};

@ApiTags('appointments')
@ApiCookieAuth()
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: UnauthorizedResponseDto })
@UseGuards(AuthGuard)
@Controller('appointments')
export class AppointmentController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista os atendimentos (RFACT006)',
    description:
      'Do mais recente ao mais antigo, paginados, com autor e o selo de retificado. O admin vê todos; o profissional, os dos PTS da equipe (RN016); o paciente, só os próprios. A retificação aparece dentro do original (RN020).',
  })
  @ApiOkResponse({ type: AppointmentListResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    example: { status: 'ERROR', message: 'Parâmetro inválido: attendance' },
  })
  @ApiForbiddenResponse(errors(appointmentsViewForbidden()))
  @ApiNotFoundResponse(errors(activityNotFound(), ptsNotFound()))
  async findAppointments(
    @Query() query: GetAppointmentsQueryDto,
    @CurrentAccount() account: AccountContext,
  ): Promise<AppointmentListResponseDto> {
    return this.appointmentsService.findAppointments(query, account);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consulta um atendimento (RFACT006)',
    description:
      'Com as retificações, da mais antiga à mais nova. A equipe e o admin veem o SOAP e a justificativa; o paciente, só o plano (P), o motivo da falta e a assinatura (RN028).',
  })
  @ApiOkResponse({ type: AppointmentDetailsResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    examples: { INVALID_ID },
  })
  @ApiForbiddenResponse(errors(appointmentsViewForbidden()))
  @ApiNotFoundResponse(errors(appointmentNotFound(), ptsNotFound()))
  async findAppointment(
    @Param('id', parseAppointmentId) id: string,
    @CurrentAccount() account: AccountContext,
  ): Promise<AppointmentDetailsResponseDto> {
    return this.appointmentsService.findAppointment(id, account);
  }

  @Post(':id/rectify')
  @ApiOperation({
    summary: 'Retifica um atendimento (RFACT007)',
    description:
      'Só o autor, com justificativa. Cria um novo registro ligado ao original, que não muda (RN020), com as mesmas regras do registro. Grava appointment_rectified na timeline.',
  })
  @ApiCreatedResponse({ type: RectifyAppointmentResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    examples: {
      REASON: {
        summary: 'Sem justificativa',
        value: {
          status: 'VALIDATION_ERROR',
          message: 'Informe a justificativa da retificação.',
        },
      },
      INVALID_ID,
    },
  })
  @ApiForbiddenResponse(errors(rectifyForbidden()))
  @ApiNotFoundResponse(errors(appointmentNotFound(), ptsNotFound()))
  async rectifyAppointment(
    @Param('id', parseAppointmentId) id: string,
    @Body() dto: RectifyAppointmentRequestDto,
    @CurrentAccount() account: AccountContext,
  ): Promise<RectifyAppointmentResponseDto> {
    return this.appointmentsService.rectifyAppointment(id, dto, account);
  }
}
