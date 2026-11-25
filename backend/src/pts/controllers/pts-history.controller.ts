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

import { CurrentAccount } from '../../auth/decorators/current-account.decorator';
import { AuthGuard } from '../../auth/guards/auth.guard';
import type { AccountContext } from '../../accounts/services/accounts.service';
import {
  ErrorResponseDto,
  UnauthorizedResponseDto,
} from '../../common/swagger/error-response.dto';
import {
  GetPtsHistoryResponseDto,
  PtsHistoryQueryDto,
} from '../dto/pts-history.dto';
import { PtsService } from '../services/pts.service';

const parsePatientId = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException({
      status: 'VALIDATION_ERROR',
      message: 'Parâmetro inválido: id',
    }),
});

@ApiTags('patients')
@Controller()
export class PtsHistoryController {
  constructor(private readonly ptsService: PtsService) {}

  @Get('patients/:id/pts')
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Consulta o histórico de PTS de um paciente (RFPTS009)',
    description:
      'Admin consulta todos; profissional consulta os PTS em que é responsável ou membro; paciente consulta os próprios.',
  })
  @ApiOkResponse({ type: GetPtsHistoryResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    example: {
      status: 'FORBIDDEN',
      message: 'Você não tem acesso ao histórico deste paciente.',
    },
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    example: {
      status: 'PATIENT_NOT_FOUND',
      message: 'Paciente não encontrado.',
    },
  })
  @ApiUnauthorizedResponse({ type: UnauthorizedResponseDto })
  findHistory(
    @Param('id', parsePatientId) patientId: string,
    @Query() query: PtsHistoryQueryDto,
    @CurrentAccount() account: AccountContext,
  ): Promise<GetPtsHistoryResponseDto> {
    return this.ptsService.findPtsHistory(patientId, query, account);
  }
}
