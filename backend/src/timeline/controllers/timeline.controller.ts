import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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
import {
  ErrorResponseDto,
  UnauthorizedResponseDto,
} from '../../common/swagger/error-response.dto';
import { GetTimelineQueryDto } from '../dto/get-timeline-query.dto';
import { GetTimelineResponseDto } from '../dto/timeline-record-response.dto';
import { TimelineService } from '../services/timeline.service';

const parsePtsId = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException({
      status: 'VALIDATION_ERROR',
      message: 'Parâmetro inválido: id',
    }),
});

@ApiTags('timeline')
@Controller('pts')
export class TimelineController {
  constructor(private readonly timelineService: TimelineService) {}

  @Get(':id/timeline')
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Consulta a timeline do PTS (RFTL001)',
    description:
      'Eventos do PTS, do mais recente ao mais antigo, paginados, com busca e filtros de tipo, autor e período. ' +
      'Veem o admin, o responsável e os membros da equipe e o paciente titular; ' +
      'para o paciente, os eventos de documento vêm sem o targetId (RN028).',
  })
  @ApiOkResponse({ type: GetTimelineResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    examples: {
      ERROR: {
        summary:
          'Parâmetro de query inválido (q, type, authorId, from, to, order, page, limit)',
        value: { status: 'ERROR', message: 'Parâmetro inválido: type' },
      },
      VALIDATION_ERROR: {
        summary: 'id da rota que não é UUID',
        value: {
          status: 'VALIDATION_ERROR',
          message: 'Parâmetro inválido: id',
        },
      },
    },
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    examples: {
      FORBIDDEN: {
        summary: 'Sem acesso ao PTS',
        value: {
          status: 'FORBIDDEN',
          message: 'Você não tem acesso à timeline deste PTS.',
        },
      },
    },
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    examples: {
      PTS_NOT_FOUND: {
        summary: 'PTS inexistente',
        value: { status: 'PTS_NOT_FOUND', message: 'PTS não encontrado.' },
      },
    },
  })
  @ApiUnauthorizedResponse({ type: UnauthorizedResponseDto })
  async findTimeline(
    @Param('id', parsePtsId) id: string,
    @Query() query: GetTimelineQueryDto,
    @CurrentAccount() account: AccountContext,
  ): Promise<GetTimelineResponseDto> {
    return this.timelineService.findTimeline(id, query, account);
  }
}
