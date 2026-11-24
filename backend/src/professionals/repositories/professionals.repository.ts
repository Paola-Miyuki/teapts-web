// Este arquivo concentra a consulta e a gravação de profissionais no banco.
// A busca usa Professional e Account existentes, com filtros combináveis,
// paginação e projeção explícita dos campos públicos da resposta.

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../../accounts/entities/account.entity';
import { Professional } from '../entities/professional.entity';
import { Specialism } from '../enums/specialism.enum';
import type { Uf } from '../enums/uf.enum';
import { escapeLike } from '../../common/search/escape-like';
import {
  type Council,
  specialismsOfCouncils,
} from '../professional-registration';

/** Nome da especialidade, para ordenar pelo texto mostrado na tela. */
const SPECIALISM_ORDER_SQL = `CASE professional.specialism WHEN 'doctor' THEN 'Medicina' WHEN 'physiotherapist' THEN 'Fisioterapia' WHEN 'psychologist' THEN 'Psicologia' END`;

/** Filtros e paginação já validados da consulta de profissionais. */
export type FindProfessionalsQuery = {
  page: number;
  limit: number;
  q?: string;
  specialism?: Specialism[];
  council?: Council[];
  councilState?: Uf;
  sort?: 'name' | 'specialism';
  order?: 'asc' | 'desc';
  ids?: string[];
};

/** Linha projetada pela consulta, só com os campos públicos. */
export type ProfessionalRow = {
  professional_id: string;
  professional_specialism: Specialism;
  professional_council_number: string | null;
  professional_council_state: Uf | null;
  professional_institution: string | null;
  professional_cnes: string | null;
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
      .innerJoin(Account, 'account', 'account.id = professional.accountId')
      .select([
        'professional.id AS professional_id',
        'professional.specialism AS professional_specialism',
        'professional.councilNumber AS professional_council_number',
        'professional.councilState AS professional_council_state',
        'professional.institution AS professional_institution',
        'professional.cnes AS professional_cnes',
        'account.name AS account_name',
        'account.email AS account_email',
      ]);

    if (filters.q !== undefined) {
      query.andWhere(
        `(account.name ILIKE :q ESCAPE '\\' OR account.email ILIKE :q ESCAPE '\\' OR professional.councilNumber ILIKE :q ESCAPE '\\')`,
        { q: `%${escapeLike(filters.q)}%` },
      );
    }

    // Profissão e conselho combinam: vale a interseção das duas listas.
    let specialisms = filters.specialism;

    if (filters.council !== undefined) {
      const ofCouncils = specialismsOfCouncils(filters.council);
      specialisms = specialisms
        ? specialisms.filter((item) => ofCouncils.includes(item))
        : ofCouncils;
    }

    if (specialisms !== undefined) {
      if (specialisms.length === 0) {
        query.andWhere('1 = 0');
      } else {
        query.andWhere('professional.specialism IN (:...specialisms)', {
          specialisms,
        });
      }
    }

    if (filters.councilState !== undefined) {
      query.andWhere('professional.councilState = :councilState', {
        councilState: filters.councilState,
      });
    }

    if (filters.ids !== undefined) {
      query.andWhere('professional.id IN (:...ids)', { ids: filters.ids });
    }

    const direction = filters.order === 'desc' ? 'DESC' : 'ASC';

    if (filters.sort === 'specialism') {
      query
        .orderBy(SPECIALISM_ORDER_SQL, direction)
        .addOrderBy('account.name', 'ASC');
    } else {
      query.orderBy('account.name', direction);
    }

    query.addOrderBy('professional.id', 'ASC');

    const total = await query.clone().getCount();
    const rows = await query
      .offset((filters.page - 1) * filters.limit)
      .limit(filters.limit)
      .getRawMany<ProfessionalRow>();

    return { rows, total };
  }

  /**
   * Grava o perfil profissional.
   *
   * @param professional conta e especialidade já validadas pelo service
   * @returns id gerado para o perfil
   * @throws erro do banco, sem tratamento (ex.: `23505` na restrição única
   *   `UQ_professional_account`)
   */
  async insert(
    professional: Pick<Professional, 'accountId' | 'specialism'>,
  ): Promise<string> {
    const result = await this.professionalRepository.insert({
      accountId: professional.accountId,
      specialism: professional.specialism,
    });

    return (result.identifiers[0] as { id: string }).id;
  }
}
