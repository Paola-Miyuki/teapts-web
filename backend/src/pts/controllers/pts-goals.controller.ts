import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
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
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import type { AccountContext } from '../../accounts/services/accounts.service';
import { CurrentAccount } from '../../auth/decorators/current-account.decorator';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { UnauthorizedResponseDto } from '../../common/swagger/error-response.dto';
import { CreateGoalRequestDto } from '../dto/create-goal.dto';
import {
  DeleteGoalResponseDto,
  GetGoalsResponseDto,
  GoalResponseDto,
} from '../dto/goal-response.dto';
import { UpdateGoalRequestDto } from '../dto/update-goal.dto';
import {
  goalForbidden,
  goalHasActivities,
  goalNotFound,
  lastGoal,
  ptsForbidden,
  ptsNotEditable,
  ptsNotFound,
  validationError,
} from '../pts.errors';
import { errors } from '../swagger-errors';
import { PtsGoalsService } from '../services/pts-goals.service';

const parseUuidParam = (name: string) =>
  new ParseUUIDPipe({
    exceptionFactory: () =>
      new BadRequestException({
        status: 'VALIDATION_ERROR',
        message: `Parâmetro inválido: ${name}`,
      }),
  });

const parsePtsId = parseUuidParam('id');
const parseGoalId = parseUuidParam('goalId');

@ApiTags('pts')
@ApiCookieAuth()
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: UnauthorizedResponseDto })
@UseGuards(AuthGuard)
@Controller('pts/:id/goals')
export class PtsGoalsController {
  constructor(private readonly goalsService: PtsGoalsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista as metas terapêuticas do PTS (RFPTS012)',
    description:
      'Veem o admin, a equipe (menos PTS rejeitado, RN016) e o paciente titular. Meta excluída não aparece.',
  })
  @ApiOkResponse({ type: GetGoalsResponseDto })
  @ApiBadRequestResponse(errors(validationError([])))
  @ApiForbiddenResponse(errors(ptsForbidden()))
  @ApiNotFoundResponse(errors(ptsNotFound()))
  async findGoals(
    @Param('id', parsePtsId) id: string,
    @CurrentAccount() account: AccountContext,
  ): Promise<GetGoalsResponseDto> {
    return this.goalsService.findGoals(id, account);
  }

  @Post()
  @ApiOperation({
    summary: 'Cadastra uma meta terapêutica (RFPTS012)',
    description:
      'Equipe ou admin, com o PTS em draft, planning ou running. A data-alvo vai até a próxima revisão. Grava goal_added na timeline.',
  })
  @ApiCreatedResponse({ type: GoalResponseDto })
  @ApiBadRequestResponse(errors(validationError([])))
  @ApiForbiddenResponse(errors(goalForbidden()))
  @ApiNotFoundResponse(errors(ptsNotFound()))
  @ApiConflictResponse(errors(ptsNotEditable()))
  async createGoal(
    @Param('id', parsePtsId) id: string,
    @Body() dto: CreateGoalRequestDto,
    @CurrentAccount() account: AccountContext,
  ): Promise<GoalResponseDto> {
    return this.goalsService.createGoal(id, dto, account);
  }

  @Patch(':goalId')
  @ApiOperation({
    summary: 'Edita uma meta terapêutica (RFPTS012)',
    description:
      'Altera só os campos enviados; a autoria não muda. Grava goal_updated na timeline.',
  })
  @ApiOkResponse({ type: GoalResponseDto })
  @ApiBadRequestResponse(errors(validationError([])))
  @ApiForbiddenResponse(errors(goalForbidden()))
  @ApiNotFoundResponse(errors(ptsNotFound(), goalNotFound()))
  @ApiConflictResponse(errors(ptsNotEditable()))
  async updateGoal(
    @Param('id', parsePtsId) id: string,
    @Param('goalId', parseGoalId) goalId: string,
    @Body() dto: UpdateGoalRequestDto,
    @CurrentAccount() account: AccountContext,
  ): Promise<GoalResponseDto> {
    return this.goalsService.updateGoal(id, goalId, dto, account);
  }

  @Delete(':goalId')
  @ApiOperation({
    summary: 'Exclui uma meta terapêutica (RFPTS012)',
    description:
      'Exclusão lógica (RN021). Recusa a última meta do PTS e a meta ligada a atividades. Grava goal_removed na timeline.',
  })
  @ApiOkResponse({ type: DeleteGoalResponseDto })
  @ApiBadRequestResponse(errors(validationError([])))
  @ApiForbiddenResponse(errors(goalForbidden()))
  @ApiNotFoundResponse(errors(ptsNotFound(), goalNotFound()))
  @ApiConflictResponse(
    errors(ptsNotEditable(), lastGoal(), goalHasActivities()),
  )
  async removeGoal(
    @Param('id', parsePtsId) id: string,
    @Param('goalId', parseGoalId) goalId: string,
    @CurrentAccount() account: AccountContext,
  ): Promise<DeleteGoalResponseDto> {
    return this.goalsService.removeGoal(id, goalId, account);
  }
}
