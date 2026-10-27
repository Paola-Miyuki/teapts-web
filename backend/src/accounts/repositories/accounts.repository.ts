// Este arquivo concentra a listagem de contas no banco.
// A query projeta só os campos públicos (id e nome) e aplica os filtros
// opcionais de perfil de paciente e de perfil profissional.

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../entities/account.entity';
import { Patient } from '../../patients/entities/patient.entity';

/** Filtros e paginação já validados da listagem de contas. */
export type AccountsQuery = {
  page: number;
  limit: number;
  isPatient?: boolean;
  isProfessional?: boolean;
};

/** Linha projetada pela consulta, só com os campos públicos. */
export type AccountRow = {
  account_id: string;
  account_name: string;
};

/** Página de linhas e total de contas. */
export type AccountsPage = {
  rows: AccountRow[];
  total: number;
};

/**
 * Acesso aos dados da listagem de contas.
 */
@Injectable()
export class AccountsRepository {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
  ) {}

  /**
   * Busca contas ordenadas por nome, com os filtros informados.
   *
   * A consulta usa offset/limit porque getRawMany ignora skip/take quando
   * há JOIN.
   *
   * @param filters filtros e paginação já validados
   * @returns linhas da página pedida e total de contas
   * @throws erro do banco, sem tratamento
   */
  async findPaginated(filters: AccountsQuery): Promise<AccountsPage> {
    const query = this.accountRepository
      .createQueryBuilder('account')
      .select(['account.id AS account_id', 'account.name AS account_name'])
      .orderBy('account.name', 'ASC')
      .addOrderBy('account.id', 'ASC');

    if (filters.isPatient !== undefined) {
      query
        .leftJoin(Patient, 'patient', 'patient."accountId" = account.id')
        .andWhere(
          filters.isPatient
            ? 'patient."accountId" IS NOT NULL'
            : 'patient."accountId" IS NULL',
        );
    }

    if (filters.isProfessional !== undefined) {
      query.andWhere(
        `${filters.isProfessional ? 'EXISTS' : 'NOT EXISTS'} (SELECT 1 FROM professional WHERE professional."accountId" = account.id)`,
      );
    }

    const total = await query.clone().getCount();
    const rows = await query
      .offset((filters.page - 1) * filters.limit)
      .limit(filters.limit)
      .getRawMany<AccountRow>();

    return { rows, total };
  }
}
