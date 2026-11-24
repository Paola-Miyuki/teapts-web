// Este arquivo concentra a listagem de contas no banco.
// A query projeta só os campos públicos, aplica a busca, os filtros (perfil,
// situação e data de criação), a ordenação e a paginação. O SQL cru usa os
// nomes reais das colunas (snake_case), não os das propriedades.

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, type SelectQueryBuilder } from 'typeorm';
import type {
  AccountProfileFilter,
  AccountSortField,
  AccountSortOrder,
} from '../dto/get-accounts-request.dto';
import { Account } from '../entities/account.entity';
import { AccountRole } from '../enums/account-role.enum';
import { AccountStatus } from '../enums/account-status.enum';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import { escapeLike } from '../../common/search/escape-like';

/** Filtros e paginação já validados da listagem de contas. */
export type AccountsQuery = {
  page: number;
  limit: number;
  q?: string;
  /** Filtro antigo do combobox: só contas de usuário com/sem paciente. */
  isPatient?: boolean;
  /** Filtro antigo do combobox: só contas de usuário com/sem profissional. */
  isProfessional?: boolean;
  profile?: AccountProfileFilter[];
  status?: AccountStatus;
  createdFrom?: string;
  createdTo?: string;
  sort?: AccountSortField;
  order?: AccountSortOrder;
};

/** Linha projetada pela consulta, só com os campos públicos. */
export type AccountRow = {
  account_id: string;
  account_name: string;
  account_social_name: string | null;
  account_email: string;
  account_cpf: string | null;
  account_role: AccountRole;
  account_status: AccountStatus;
  account_created_at: Date;
  account_profile: AccountProfileFilter;
  account_specialisms: string[] | null;
};

/** Página de linhas e total de contas. */
export type AccountsPage = {
  rows: AccountRow[];
  total: number;
};

// Subconsultas com os nomes reais das colunas no banco (snake_case).
const HAS_PATIENT_SQL =
  'EXISTS (SELECT 1 FROM patient WHERE patient.account_id = account.id)';
const HAS_PROFESSIONAL_SQL =
  'EXISTS (SELECT 1 FROM professional WHERE professional.account_id = account.id)';
const PROFILE_SQL = `CASE WHEN account.role = '${AccountRole.Admin}' THEN 'admin' WHEN ${HAS_PATIENT_SQL} THEN 'patient' WHEN ${HAS_PROFESSIONAL_SQL} THEN 'professional' ELSE 'none' END`;
const SPECIALISMS_SQL =
  "(SELECT COALESCE(array_agg(professional.specialism::text ORDER BY professional.specialism), '{}') FROM professional WHERE professional.account_id = account.id)";
const DISPLAY_NAME_SQL = `COALESCE(NULLIF(account.social_name, ''), account.name)`;

/** Condição de cada valor do filtro `profile`. */
const PROFILE_CONDITIONS: Record<AccountProfileFilter, string> = {
  none: `(account.role = '${AccountRole.User}' AND NOT ${HAS_PATIENT_SQL} AND NOT ${HAS_PROFESSIONAL_SQL})`,
  patient: HAS_PATIENT_SQL,
  professional: HAS_PROFESSIONAL_SQL,
  admin: `account.role = '${AccountRole.Admin}'`,
};

/** Estados de PTS em que o perfil profissional responde pelo PTS ou o integra. */
const ACTIVE_PTS_STATES = [PtsStateEnum.PLANNING, PtsStateEnum.RUNNING];

/** Resultado da desativação, decidido dentro da transação. */
export type DeactivationResult =
  | { outcome: 'not_found' }
  | { outcome: 'already_deactivated' }
  | { outcome: 'pts_responsible' }
  | {
      outcome: 'deactivated';
      supertokensUserId: string;
      deactivatedAt: Date;
    };

/**
 * Acesso aos dados da listagem de contas e à desativação (exclusão lógica).
 */
@Injectable()
export class AccountsRepository {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
  ) {}

  /**
   * Monta a consulta da listagem, sem paginação. Sem filtro de perfil nem os
   * filtros antigos `isPatient`/`isProfessional`, traz todas as contas,
   * inclusive as de admin; os filtros antigos mantêm só contas de usuário
   * (RN002), como o combobox de perfis espera.
   *
   * @param filters filtros já validados
   * @returns query builder pronto para contar e paginar
   */
  buildListQuery(filters: AccountsQuery): SelectQueryBuilder<Account> {
    const query = this.accountRepository
      .createQueryBuilder('account')
      .select([
        'account.id AS account_id',
        'account.name AS account_name',
        'account.social_name AS account_social_name',
        'account.email AS account_email',
        'account.cpf AS account_cpf',
        'account.role AS account_role',
        'account.status AS account_status',
        'account.created_at AS account_created_at',
      ])
      .addSelect(PROFILE_SQL, 'account_profile')
      .addSelect(SPECIALISMS_SQL, 'account_specialisms');

    if (
      filters.isPatient !== undefined ||
      filters.isProfessional !== undefined
    ) {
      query.where('account.role = :role', { role: AccountRole.User });
    } else {
      query.where('1 = 1');
    }

    if (filters.q !== undefined) {
      const digits = filters.q.replace(/\D/g, '');
      const onlyDigits = digits.length > 0 && /^[\d\s.\-/]+$/.test(filters.q);

      query.andWhere(
        new Brackets((where) => {
          for (const column of [
            'account.name',
            'account.social_name',
            'account.email',
            'account.cpf',
          ]) {
            where.orWhere(`${column} ILIKE :term ESCAPE '\\'`);
          }

          if (onlyDigits) {
            where.orWhere(
              `regexp_replace(account.cpf, '\\D', '', 'g') LIKE :digits`,
            );
          }
        }),
        { term: `%${escapeLike(filters.q)}%`, digits: `%${digits}%` },
      );
    }

    if (filters.isPatient !== undefined) {
      query.andWhere(
        filters.isPatient ? HAS_PATIENT_SQL : `NOT ${HAS_PATIENT_SQL}`,
      );
    }

    if (filters.isProfessional !== undefined) {
      query.andWhere(
        filters.isProfessional
          ? HAS_PROFESSIONAL_SQL
          : `NOT ${HAS_PROFESSIONAL_SQL}`,
      );
    }

    if (filters.profile !== undefined) {
      query.andWhere(
        new Brackets((where) => {
          for (const profile of filters.profile ?? []) {
            where.orWhere(PROFILE_CONDITIONS[profile]);
          }
        }),
      );
    }

    if (filters.status !== undefined) {
      query.andWhere('account.status = :status', { status: filters.status });
    }

    if (filters.createdFrom !== undefined) {
      query.andWhere('account.created_at >= CAST(:createdFrom AS date)', {
        createdFrom: filters.createdFrom,
      });
    }

    if (filters.createdTo !== undefined) {
      query.andWhere('account.created_at < CAST(:createdTo AS date) + 1', {
        createdTo: filters.createdTo,
      });
    }

    const direction = filters.order === 'desc' ? 'DESC' : 'ASC';

    if (filters.sort === 'createdAt') {
      query.orderBy('account.created_at', direction);
      query.addOrderBy(DISPLAY_NAME_SQL, 'ASC');
    } else {
      query.orderBy(DISPLAY_NAME_SQL, direction);
    }

    return query.addOrderBy('account.id', 'ASC');
  }

  /**
   * Busca uma página de contas, com a busca, os filtros e a ordenação
   * informados.
   *
   * A consulta usa offset/limit porque getRawMany ignora skip/take.
   *
   * @param filters filtros e paginação já validados
   * @returns linhas da página pedida e total de contas
   * @throws erro do banco, sem tratamento
   */
  async findPaginated(filters: AccountsQuery): Promise<AccountsPage> {
    const query = this.buildListQuery(filters);
    const total = await query.clone().getCount();
    const rows = await query
      .offset((filters.page - 1) * filters.limit)
      .limit(filters.limit)
      .getRawMany<AccountRow>();

    return { rows, total };
  }

  /**
   * Desativa a conta numa transação (RFAUT005, RN021): confere a situação e
   * se o perfil profissional é responsável por PTS ativo (RN007), grava a
   * situação e retira o perfil profissional das equipes de PTS em `planning`
   * ou `running`. Perfis e registros do profissional ficam como estão.
   *
   * A linha da conta fica travada até o fim, então duas desativações
   * simultâneas não passam juntas.
   *
   * @param accountId conta a desativar
   * @param executedByAccountId conta que pediu a desativação
   * @returns o desfecho; só `deactivated` grava alguma coisa
   * @throws erro do banco, sem tratamento
   */
  async deactivate(
    accountId: string,
    executedByAccountId: string,
  ): Promise<DeactivationResult> {
    return this.accountRepository.manager.transaction(async (manager) => {
      const account = await manager
        .createQueryBuilder(Account, 'account')
        .setLock('pessimistic_write')
        .where('account.id = :accountId', { accountId })
        .getOne();

      if (!account) {
        return { outcome: 'not_found' };
      }

      if (account.status === AccountStatus.Inactive) {
        return { outcome: 'already_deactivated' };
      }

      const responsiblePts = await manager.query<unknown[]>(
        `SELECT 1 FROM projeto_terapeutico_singular pts
         INNER JOIN professional ON professional.id = pts.responsible_professional_id
         WHERE professional.account_id = $1 AND pts.status = ANY($2::pts_state_e[])
         LIMIT 1`,
        [accountId, ACTIVE_PTS_STATES],
      );

      if (responsiblePts.length > 0) {
        return { outcome: 'pts_responsible' };
      }

      const deactivatedAt = new Date();

      await manager.update(
        Account,
        { id: accountId },
        {
          status: AccountStatus.Inactive,
          deactivatedAt,
          deactivatedByAccountId: executedByAccountId,
        },
      );
      await manager.query(
        `DELETE FROM professional_participating_on_therapeutic_journey membership
         USING professional, projeto_terapeutico_singular pts
         WHERE professional.account_id = $1
           AND membership.professional_id = professional.id
           AND pts.id = membership.therapeutic_journey_id
           AND pts.status = ANY($2::pts_state_e[])`,
        [accountId, ACTIVE_PTS_STATES],
      );

      return {
        outcome: 'deactivated',
        supertokensUserId: account.supertokensUserId,
        deactivatedAt,
      };
    });
  }
}
