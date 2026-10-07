// Este arquivo expõe o endpoint autenticado de consulta de profissionais.
// O controller normaliza a query e delega a consulta ao ProfessionalsService.

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import {
  type GetProfessionalsQuery,
  normalizeGetProfessionalsQuery,
} from './dto/get-professionals-request.dto';
import type { GetProfessionalsResponseDto } from './dto/get-professionals-response.dto';
import { ProfessionalsService } from './professionals.service';

/**
 * Expõe a consulta autenticada de profissionais para seleção.
 */
@Controller()
export class ProfessionalsController {
  constructor(private readonly professionalsService: ProfessionalsService) {}

  /**
   * Retorna profissionais filtrados e paginados.
   *
   * A query string é normalizada antes de chegar ao service, garantindo que
   * somente parâmetros válidos sejam usados na consulta ao banco.
   *
   * @param query parâmetros brutos recebidos na URL
   * @returns profissionais compatíveis e dados de paginação
   */
  @Get('professionals')
  @UseGuards(AuthGuard)
  async findAll(
    @Query() query: GetProfessionalsQuery,
  ): Promise<GetProfessionalsResponseDto> {
    return this.professionalsService.findAll(
      normalizeGetProfessionalsQuery(query),
    );
  }
}
