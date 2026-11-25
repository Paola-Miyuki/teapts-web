import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
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
import {
  RegisterReassessmentRequestDto,
  RegisterReassessmentResponseDto,
} from '../dto/register-reassessment.dto';
import {
  draftAlreadyExists,
  ptsNotFound,
  validationError,
} from '../pts.errors';
import {
  goalsWithoutResult,
  reassessmentForbidden,
  reassessmentNotRunning,
} from '../reassessment.errors';
import { PtsReassessmentService } from '../services/pts-reassessment.service';
import { errors } from '../swagger-errors';

const parsePtsId = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException({
      status: 'VALIDATION_ERROR',
      message: 'Parâmetro inválido: id',
    }),
});

@ApiTags('pts')
@ApiCookieAuth()
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: UnauthorizedResponseDto })
@UseGuards(AuthGuard)
@Controller('pts/:id/reassessment')
export class PtsReassessmentController {
  constructor(private readonly reassessmentService: PtsReassessmentService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Registra a reavaliação e encerra o ciclo (RFEVA005)',
    description:
      'Só o responsável (ou o admin, RN022), com o PTS em running e todas as metas em andamento avaliadas. Grava o resultado das metas e a data do encontro, conclui o PTS como o RFPTS010 (atividades em andamento ou suspensas concluídas junto) e, com createNextVersion, cria o rascunho da próxima versão (RFPTS013). Grava pts_reassessed, pts_concluded e next_version_created na timeline.',
  })
  @ApiOkResponse({ type: RegisterReassessmentResponseDto })
  @ApiBadRequestResponse(errors(validationError([]), goalsWithoutResult(2)))
  @ApiForbiddenResponse(errors(reassessmentForbidden()))
  @ApiNotFoundResponse(errors(ptsNotFound()))
  @ApiConflictResponse(errors(reassessmentNotRunning(), draftAlreadyExists()))
  async registerReassessment(
    @Param('id', parsePtsId) id: string,
    @Body() dto: RegisterReassessmentRequestDto,
    @CurrentAccount() account: AccountContext,
  ): Promise<RegisterReassessmentResponseDto> {
    return this.reassessmentService.registerReassessment(id, dto, account);
  }
}
