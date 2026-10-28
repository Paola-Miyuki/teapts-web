// Este arquivo expõe o endpoint autenticado de consulta de profissionais.
// O ValidationPipe global valida a query, e o controller delega a consulta
// ao ProfessionalsService.

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { GetProfessionalsRequestDto } from '../dto/get-professionals-request.dto';
import { GetProfessionalsResponseDto } from '../dto/get-professionals-response.dto';
import {
  ErrorResponseDto,
  UnauthorizedResponseDto,
} from '../../common/swagger/error-response.dto';
import { ProfessionalsService } from '../services/professionals.service';

/**
 * Expõe a consulta autenticada de profissionais para seleção.
 */
@ApiTags('professionals')
@Controller()
export class ProfessionalsController {
  constructor(private readonly professionalsService: ProfessionalsService) {}

  /**
   * Retorna profissionais filtrados e paginados.
   *
   * A query string é validada e normalizada pelo ValidationPipe global antes
   * de chegar aqui, garantindo que somente parâmetros válidos sejam usados na
   * consulta ao banco.
   *
   * @param query parâmetros já normalizados
   * @returns profissionais compatíveis e dados de paginação
   */
  @Get('professionals')
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  @ApiBearerAuth()
  @ApiOkResponse({ type: GetProfessionalsResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    example: { status: 'ERROR', message: 'Parâmetro inválido: limit' },
  })
  @ApiUnauthorizedResponse({ type: UnauthorizedResponseDto })
  @ApiInternalServerErrorResponse({
    type: ErrorResponseDto,
    example: {
      status: 'ERROR',
      message: 'Não foi possível consultar os profissionais.',
    },
  })
  async findAll(
    @Query() query: GetProfessionalsRequestDto,
  ): Promise<GetProfessionalsResponseDto> {
    return this.professionalsService.findAll(query);
  }
}
