import {
  BadRequestException,
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import type { AccountContext } from '../../accounts/services/accounts.service';
import {
  activityNotFound,
  missingVisitPlace,
} from '../../activities/activities.errors';
import { CurrentAccount } from '../../auth/decorators/current-account.decorator';
import { AuthGuard } from '../../auth/guards/auth.guard';
import {
  ErrorResponseDto,
  UnauthorizedResponseDto,
} from '../../common/swagger/error-response.dto';
import { ptsNotFound, type PtsApiError } from '../../pts/pts.errors';
import { errors } from '../../pts/swagger-errors';
import {
  activityNotRunning,
  appointmentForbidden,
  appointmentPtsNotActive,
  futureAppointment,
  incompleteAppointment,
  invalidAppointmentAuthor,
  invalidAppointmentEnd,
  soapNotAllowed,
} from '../appointments.errors';
import { AppointmentResponseDto } from '../dto/appointment-response.dto';
import { CreateAppointmentRequestDto } from '../dto/create-appointment.dto';
import { AppointmentsService } from '../services/appointments.service';

const invalidId = () =>
  new BadRequestException({
    status: 'VALIDATION_ERROR',
    message: 'Parâmetro inválido: id',
  });

// As recusas de 400 têm o mesmo status, então o exemplo não sai do errors().
function example(error: BadRequestException | PtsApiError) {
  const { status, message } = error.getResponse() as {
    status: string;
    message: string;
  };

  return { summary: message, value: { status, message } };
}

const parseActivityId = new ParseUUIDPipe({
  exceptionFactory: invalidId,
});

@ApiTags('appointments')
@ApiCookieAuth()
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: UnauthorizedResponseDto })
@UseGuards(AuthGuard)
@Controller('activities/:id/appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @ApiOperation({
    summary: 'Registra um atendimento (RFACT004)',
    description:
      'Equipe do PTS ativo ou admin, em atividade em andamento, inclusive da família ou da escola. O realizado exige endTime e os quatro campos do SOAP; falta e desmarcação não têm SOAP. No realizado, o término é depois do início; só a desmarcação aceita data futura. O registro não é editado (RN020). Grava appointment_registered na timeline.',
  })
  @ApiCreatedResponse({ type: AppointmentResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    examples: {
      INCOMPLETE: example(incompleteAppointment()),
      SOAP_NOT_ALLOWED: example(soapNotAllowed()),
      INVALID_END: example(invalidAppointmentEnd()),
      FUTURE_DATE: example(futureAppointment()),
      VISIT_PLACE: example(missingVisitPlace()),
      INVALID_AUTHOR: example(invalidAppointmentAuthor()),
      INVALID_ID: example(invalidId()),
    },
  })
  @ApiForbiddenResponse(errors(appointmentForbidden()))
  @ApiNotFoundResponse(errors(activityNotFound(), ptsNotFound()))
  @ApiConflictResponse(errors(activityNotRunning(), appointmentPtsNotActive()))
  async createAppointment(
    @Param('id', parseActivityId) id: string,
    @Body() dto: CreateAppointmentRequestDto,
    @CurrentAccount() account: AccountContext,
  ): Promise<AppointmentResponseDto> {
    return this.appointmentsService.createAppointment(id, dto, account);
  }
}
