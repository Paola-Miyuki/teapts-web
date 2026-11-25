import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import type { AccountContext } from '../../accounts/services/accounts.service';
import { CurrentAccount } from '../../auth/decorators/current-account.decorator';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { UnauthorizedResponseDto } from '../../common/swagger/error-response.dto';
import {
  ptsNotEditable,
  ptsNotFound,
  validationError,
} from '../../pts/pts.errors';
import { errors } from '../../pts/swagger-errors';
import {
  activitiesViewForbidden,
  activityArchiveForbidden,
  activityDecisionForbidden,
  activityEditForbidden,
  activityNotArchivable,
  activityNotEditable,
  activityNotFound,
  activityNotSuggested,
  activityStatusForbidden,
  invalidActivityTransition,
  invalidFrequency,
} from '../activities.errors';
import {
  ActivityDetailsResponseDto,
  ActivityResponseDto,
} from '../dto/activity-response.dto';
import {
  ArchiveActivityRequestDto,
  ArchiveActivityResponseDto,
} from '../dto/archive-activity.dto';
import {
  ActivityStatusResponseDto,
  SuspendActivityRequestDto,
} from '../dto/activity-status.dto';
import {
  ActivityDecisionResponseDto,
  RejectActivityRequestDto,
} from '../dto/activity-decision.dto';
import { UpdateActivityRequestDto } from '../dto/update-activity.dto';
import { ActivitiesService } from '../services/activities.service';

const parseActivityId = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException({
      status: 'VALIDATION_ERROR',
      message: 'Parâmetro inválido: id',
    }),
});

// Rotas de uma atividade pelo id dela (`/activities/:id`).
@ApiTags('activities')
@ApiCookieAuth()
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: UnauthorizedResponseDto })
@UseGuards(AuthGuard)
@Controller('activities')
export class ActivityController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get(':id')
  @ApiOperation({
    summary: 'Consulta uma atividade (RFACT002)',
    description:
      'Retorna os dados da atividade, a meta e os documentos associados. O paciente titular não vê os documentos (RN028).',
  })
  @ApiOkResponse({ type: ActivityDetailsResponseDto })
  @ApiBadRequestResponse(errors(validationError([])))
  @ApiForbiddenResponse(errors(activitiesViewForbidden()))
  @ApiNotFoundResponse(errors(activityNotFound(), ptsNotFound()))
  async findActivityById(
    @Param('id', parseActivityId) id: string,
    @CurrentAccount() account: AccountContext,
  ): Promise<ActivityDetailsResponseDto> {
    return this.activitiesService.findActivityById(id, account);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Edita uma atividade (RFACT005)',
    description:
      'O autor edita a sugerida; o responsável do PTS, a sugerida ou em andamento; o admin, qualquer uma (RN022). Rejeitada ou arquivada não muda. Altera só os campos enviados; goalId null desliga a meta. Meta do mesmo PTS e documentos do mesmo paciente (RN013). Grava activity_updated e, ao desligar a meta, activity_goal_unlinked.',
  })
  @ApiOkResponse({ type: ActivityResponseDto })
  @ApiBadRequestResponse(errors(validationError([])))
  @ApiForbiddenResponse(errors(activityEditForbidden()))
  @ApiNotFoundResponse(errors(activityNotFound(), ptsNotFound()))
  @ApiConflictResponse(errors(activityNotEditable(), ptsNotEditable()))
  @ApiUnprocessableEntityResponse(errors(invalidFrequency()))
  async updateActivity(
    @Param('id', parseActivityId) id: string,
    @Body() dto: UpdateActivityRequestDto,
    @CurrentAccount() account: AccountContext,
  ): Promise<ActivityResponseDto> {
    return this.activitiesService.updateActivity(id, dto, account);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Arquiva uma atividade (RFACT008)',
    description:
      'Equipe do PTS ou admin arquiva a atividade sugerida, em andamento ou suspensa. Exclusão lógica (RN021): os atendimentos continuam. Grava o motivo opcional e activity_archived na timeline.',
  })
  @ApiOkResponse({ type: ArchiveActivityResponseDto })
  @ApiBadRequestResponse(errors(validationError([])))
  @ApiForbiddenResponse(errors(activityArchiveForbidden()))
  @ApiNotFoundResponse(errors(activityNotFound(), ptsNotFound()))
  @ApiConflictResponse(errors(activityNotArchivable(), ptsNotEditable()))
  async archiveActivity(
    @Param('id', parseActivityId) id: string,
    @Body() dto: ArchiveActivityRequestDto,
    @CurrentAccount() account: AccountContext,
  ): Promise<ArchiveActivityResponseDto> {
    return this.activitiesService.archiveActivity(id, dto, account);
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Suspende uma atividade em andamento (RFACT009)',
    description:
      'Equipe do PTS ou admin, com motivo opcional. Grava activity_suspended na timeline.',
  })
  @ApiOkResponse({ type: ActivityStatusResponseDto })
  @ApiBadRequestResponse(errors(validationError([])))
  @ApiForbiddenResponse(errors(activityStatusForbidden()))
  @ApiNotFoundResponse(errors(activityNotFound(), ptsNotFound()))
  @ApiConflictResponse(errors(invalidActivityTransition(), ptsNotEditable()))
  async suspendActivity(
    @Param('id', parseActivityId) id: string,
    @Body() dto: SuspendActivityRequestDto,
    @CurrentAccount() account: AccountContext,
  ): Promise<ActivityStatusResponseDto> {
    return this.activitiesService.changeActivityStatus(
      id,
      'suspend',
      dto,
      account,
    );
  }

  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retoma uma atividade suspensa (RFACT009)',
    description: 'Equipe do PTS ou admin. Grava activity_resumed na timeline.',
  })
  @ApiOkResponse({ type: ActivityStatusResponseDto })
  @ApiBadRequestResponse(errors(validationError([])))
  @ApiForbiddenResponse(errors(activityStatusForbidden()))
  @ApiNotFoundResponse(errors(activityNotFound(), ptsNotFound()))
  @ApiConflictResponse(errors(invalidActivityTransition(), ptsNotEditable()))
  async resumeActivity(
    @Param('id', parseActivityId) id: string,
    @CurrentAccount() account: AccountContext,
  ): Promise<ActivityStatusResponseDto> {
    return this.activitiesService.changeActivityStatus(
      id,
      'resume',
      {},
      account,
    );
  }

  @Post(':id/conclude')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Conclui uma atividade em andamento ou suspensa (RFACT009)',
    description:
      'Equipe do PTS ou admin. A concluída não volta a running. Grava activity_concluded na timeline.',
  })
  @ApiOkResponse({ type: ActivityStatusResponseDto })
  @ApiBadRequestResponse(errors(validationError([])))
  @ApiForbiddenResponse(errors(activityStatusForbidden()))
  @ApiNotFoundResponse(errors(activityNotFound(), ptsNotFound()))
  @ApiConflictResponse(errors(invalidActivityTransition(), ptsNotEditable()))
  async concludeActivity(
    @Param('id', parseActivityId) id: string,
    @CurrentAccount() account: AccountContext,
  ): Promise<ActivityStatusResponseDto> {
    return this.activitiesService.changeActivityStatus(
      id,
      'conclude',
      {},
      account,
    );
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Aprova uma atividade sugerida (RFACT003)',
    description:
      'Equipe do PTS (autor e responsável inclusive) ou admin. A aprovada entra em execução (running). Grava activity_approved na timeline.',
  })
  @ApiOkResponse({ type: ActivityDecisionResponseDto })
  @ApiBadRequestResponse(errors(validationError([])))
  @ApiForbiddenResponse(errors(activityDecisionForbidden()))
  @ApiNotFoundResponse(errors(activityNotFound(), ptsNotFound()))
  @ApiConflictResponse(errors(activityNotSuggested(), ptsNotEditable()))
  async approveActivity(
    @Param('id', parseActivityId) id: string,
    @CurrentAccount() account: AccountContext,
  ): Promise<ActivityDecisionResponseDto> {
    return this.activitiesService.decideActivity(id, 'approve', {}, account);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rejeita uma atividade sugerida (RFACT003)',
    description:
      'Equipe do PTS (autor e responsável inclusive) ou admin, com motivo opcional. Grava activity_rejected na timeline.',
  })
  @ApiOkResponse({ type: ActivityDecisionResponseDto })
  @ApiBadRequestResponse(errors(validationError([])))
  @ApiForbiddenResponse(errors(activityDecisionForbidden()))
  @ApiNotFoundResponse(errors(activityNotFound(), ptsNotFound()))
  @ApiConflictResponse(errors(activityNotSuggested(), ptsNotEditable()))
  async rejectActivity(
    @Param('id', parseActivityId) id: string,
    @Body() dto: RejectActivityRequestDto,
    @CurrentAccount() account: AccountContext,
  ): Promise<ActivityDecisionResponseDto> {
    return this.activitiesService.decideActivity(id, 'reject', dto, account);
  }
}
