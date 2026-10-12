// Este arquivo concentra a consulta de profissionais no banco.
// A busca usa Professional e Account existentes, com filtros combináveis,
// paginação e projeção explícita dos campos públicos da resposta.

import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../database/entities/account.entity';
import { Professional } from '../database/entities/professional.entity';
import { Specialism } from '../database/enums/specialism.enum';
import type { GetProfessionalsRequestDto } from './dto/get-professionals-request.dto';
import type {
  GetProfessionalsResponseDto,
  ProfessionalSummaryResponseDto,
} from './dto/get-professionals-response.dto';

type ProfessionalRow = {
  professional_id: string;
  professional_specialism: Specialism;
  account_name: string;
  account_email: string;
};

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
    @InjectRepository(Professional)
    private readonly professionalRepository: Repository<Professional>,
  ) {}

  /**
   * Busca profissionais com filtros combináveis e paginação.
   *
   * A consulta usa uma projeção explícita para não retornar a entidade
   * `Account` inteira nem seus campos internos.
   *
   * @param request parâmetros já normalizados pelo controller
   * @returns profissionais compatíveis e metadados da paginação
   */
  async findAll(
    request: GetProfessionalsRequestDto,
  ): Promise<GetProfessionalsResponseDto> {
    const query = this.professionalRepository
      .createQueryBuilder('professional')
      .innerJoin(Account, 'account', 'account.id = professional."accountId"')
      .select([
        'professional.id AS professional_id',
        'professional.specialism AS professional_specialism',
        'account.name AS account_name',
        'account.email AS account_email',
      ]);

    if (request.name !== undefined) {
      query.andWhere('LOWER(account.name) LIKE LOWER(:name)', {
        name: `%${request.name}%`,
      });
    }

    if (request.specialism !== undefined) {
      query.andWhere('professional.specialism = :specialism', {
        specialism: request.specialism,
      });
    }

    if (request.ids !== undefined) {
      query.andWhere('professional.id IN (:...ids)', { ids: request.ids });
    }

    query.orderBy('account.name', 'ASC').addOrderBy('professional.id', 'ASC');

    let total: number;
    let rows: ProfessionalRow[];

    try {
      total = await query.clone().getCount();
      rows = await query
        .skip((request.page - 1) * request.limit)
        .take(request.limit)
        .getRawMany<ProfessionalRow>();
    } catch (error) {
      this.logger.error('Professionals query failed', error);
      throw new InternalServerErrorException({
        status: 'ERROR',
        message: 'Não foi possível consultar os profissionais.',
      });
    }

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
