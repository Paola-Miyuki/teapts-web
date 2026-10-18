// Este arquivo concentra a regra da consulta de profissionais.
// A query fica no ProfessionalsRepository; aqui ficam o erro seguro,
// a conversão para o contrato público e os metadados da paginação.

import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Specialism } from '../enums/specialism.enum';
import type { GetProfessionalsRequestDto } from '../dto/get-professionals-request.dto';
import type {
  GetProfessionalsResponseDto,
  ProfessionalSummaryResponseDto,
} from '../dto/get-professionals-response.dto';
import {
  type ProfessionalRow,
  type ProfessionalsPage,
  ProfessionalsRepository,
} from '../repositories/professionals.repository';

const SPECIALISM_NAMES: Record<Specialism, string> = {
  [Specialism.Psychologist]: 'Psicologia',
  [Specialism.Doctor]: 'Medicina',
  [Specialism.Physiotherapist]: 'Fisioterapia',
};

/**
 * Consulta perfis profissionais usando somente campos públicos necessários.
 */
@Injectable()
export class ProfessionalsService {
  private readonly logger = new Logger(ProfessionalsService.name);

  constructor(
    private readonly professionalsRepository: ProfessionalsRepository,
  ) {}

  /**
   * Busca profissionais com filtros combináveis e paginação.
   *
   * @param request parâmetros já validados pelo ValidationPipe global
   * @returns profissionais compatíveis e metadados da paginação
   * @throws InternalServerErrorException quando a consulta ao banco falha,
   *   sem expor o erro original
   */
  async findAll(
    request: GetProfessionalsRequestDto,
  ): Promise<GetProfessionalsResponseDto> {
    let page: ProfessionalsPage;

    try {
      page = await this.professionalsRepository.findPaginated(request);
    } catch (error) {
      this.logger.error('Professionals query failed', error);
      throw new InternalServerErrorException({
        status: 'ERROR',
        message: 'Não foi possível consultar os profissionais.',
      });
    }

    const { rows, total } = page;

    return {
      data: rows.map((row) => this.toResponse(row)),
      pagination: {
        page: request.page,
        limit: request.limit,
        total,
        totalPages: Math.ceil(total / request.limit),
      },
    };
  }

  /**
   * Converte uma linha projetada pelo banco no contrato público da API.
   */
  private toResponse(row: ProfessionalRow): ProfessionalSummaryResponseDto {
    return {
      id: row.professional_id,
      name: row.account_name,
      email: row.account_email,
      specialism: {
        id: row.professional_specialism,
        name: SPECIALISM_NAMES[row.professional_specialism],
      },
    };
  }
}
