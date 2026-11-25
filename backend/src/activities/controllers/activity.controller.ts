import {
  BadRequestException,
  Body,
  Controller,
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
  activityArchiveForbidden,
  activityEditForbidden,
  activityNotArchivable,
  activityNotEditable,
  activityNotFound,
  invalidFrequency,
} from '../activities.errors';
import { ActivityResponseDto } from '../dto/activity-response.dto';
import {
  ArchiveActivityRequestDto,
  ArchiveActivityResponseDto,
} from '../dto/archive-activity.dto';
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
}
