import {
  BadRequestException,
  Body,
  Controller,
  Get,
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
  ptsForbidden,
  ptsNotEditable,
  ptsNotFound,
  validationError,
} from '../../pts/pts.errors';
import { errors } from '../../pts/swagger-errors';
import { activityForbidden, invalidFrequency } from '../activities.errors';
import {
  ActivityResponseDto,
  GetActivitiesResponseDto,
} from '../dto/activity-response.dto';
import { CreateActivityRequestDto } from '../dto/create-activity.dto';
import { ActivitiesService } from '../services/activities.service';

const parsePtsId = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException({
      status: 'VALIDATION_ERROR',
      message: 'Parâmetro inválido: id',
    }),
});

@ApiTags('activities')
@ApiCookieAuth()
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: UnauthorizedResponseDto })
@UseGuards(AuthGuard)
@Controller('pts/:id/activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista as atividades do PTS',
    description:
      'Da mais recente à mais antiga, sem paginação nem filtros (RFACT002). Veem o admin, a equipe (menos PTS rejeitado, RN016) e o paciente titular.',
  })
  @ApiOkResponse({ type: GetActivitiesResponseDto })
  @ApiBadRequestResponse(errors(validationError([])))
  @ApiForbiddenResponse(errors(ptsForbidden()))
  @ApiNotFoundResponse(errors(ptsNotFound()))
  async findActivities(
    @Param('id', parsePtsId) id: string,
    @CurrentAccount() account: AccountContext,
  ): Promise<GetActivitiesResponseDto> {
    return this.activitiesService.findActivities(id, account);
  }

  @Post()
  @ApiOperation({
    summary: 'Cria uma atividade suggested (RFACT001, RN012)',
    description:
      'Equipe ou admin, com o PTS em draft, planning ou running. Meta do mesmo PTS e documentos do mesmo paciente (RN013). Grava activity_suggested na timeline.',
  })
  @ApiCreatedResponse({ type: ActivityResponseDto })
  @ApiBadRequestResponse(errors(validationError([])))
  @ApiForbiddenResponse(errors(activityForbidden()))
  @ApiNotFoundResponse(errors(ptsNotFound()))
  @ApiConflictResponse(errors(ptsNotEditable()))
  @ApiUnprocessableEntityResponse(errors(invalidFrequency()))
  async createActivity(
    @Param('id', parsePtsId) id: string,
    @Body() dto: CreateActivityRequestDto,
    @CurrentAccount() account: AccountContext,
  ): Promise<ActivityResponseDto> {
    return this.activitiesService.createActivity(id, dto, account);
  }
}
