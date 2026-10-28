// Este arquivo concentra a consulta de profissionais no banco.
// A busca usa Professional e Account existentes, com filtros combináveis,
// paginação e projeção explícita dos campos públicos da resposta.

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../../accounts/entities/account.entity';
import { Professional } from '../entities/professional.entity';
import { Specialism } from '../enums/specialism.enum';

/** Filtros e paginação já validados da consulta de profissionais. */
export type FindProfessionalsQuery = {
  page: number;
  limit: number;
  name?: string;
  specialism?: Specialism;
  ids?: string[];
};

/** Linha projetada pela consulta, só com os campos públicos. */
export type ProfessionalRow = {
  professional_id: string;
  professional_specialism: Specialism;
  account_name: string;
  account_email: string;
};

/** Página de linhas e total de profissionais compatíveis com os filtros. */
export type ProfessionalsPage = {
  rows: ProfessionalRow[];
  total: number;
};

/**
 * Acesso a dados dos perfis profissionais.
 */
@Injectable()
export class ProfessionalsRepository {
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
   * @param filters filtros e paginação já validados
   * @returns linhas da página pedida e total de profissionais compatíveis
   * @throws erro do banco, sem tratamento (o service decide a resposta)
   */
  async findPaginated(
    filters: FindProfessionalsQuery,
  ): Promise<ProfessionalsPage> {
    const query = this.professionalRepository
      .createQueryBuilder('professional')
      .innerJoin(Account, 'account', 'account.id = professional."accountId"')
      .select([
        'professional.id AS professional_id',
        'professional.specialism AS professional_specialism',
        'account.name AS account_name',
        'account.email AS account_email',
      ]);

    if (filters.name !== undefined) {
      query.andWhere('LOWER(account.name) LIKE LOWER(:name)', {
        name: `%${filters.name}%`,
      });
    }

    if (filters.specialism !== undefined) {
      query.andWhere('professional.specialism = :specialism', {
        specialism: filters.specialism,
      });
    }

    if (filters.ids !== undefined) {
      query.andWhere('professional.id IN (:...ids)', { ids: filters.ids });
    }

    query.orderBy('account.name', 'ASC').addOrderBy('professional.id', 'ASC');

    const total = await query.clone().getCount();
    const rows = await query
      .offset((filters.page - 1) * filters.limit)
      .limit(filters.limit)
      .getRawMany<ProfessionalRow>();

    return { rows, total };
  }
}
