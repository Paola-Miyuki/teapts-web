// Este arquivo concentra a listagem de contas no banco.
// A query projeta só os campos públicos (id, nome e e-mail), lista só contas
// de usuário e aplica a busca por nome ou e-mail e os filtros opcionais de
// perfil de paciente e de perfil profissional.

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../entities/account.entity';
import { AccountRole } from '../enums/account-role.enum';
import { AccountStatus } from '../enums/account-status.enum';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import { escapeLike } from '../../common/search/escape-like';
import { Patient } from '../../patients/entities/patient.entity';

/** Filtros e paginação já validados da listagem de contas. */
export type AccountsQuery = {
  page: number;
  limit: number;
  q?: string;
  isPatient?: boolean;
  isProfessional?: boolean;
};

/** Linha projetada pela consulta, só com os campos públicos. */
export type AccountRow = {
  account_id: string;
  account_name: string;
  account_email: string;
  account_status: AccountStatus;
};

/** Página de linhas e total de contas. */
export type AccountsPage = {
  rows: AccountRow[];
  total: number;
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
   * Busca contas de usuário ordenadas por nome, com a busca e os filtros
   * informados.
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
      .select([
        'account.id AS account_id',
        'account.name AS account_name',
        'account.email AS account_email',
        'account.status AS account_status',
      ])
      // Conta de admin não recebe perfil de paciente nem profissional (RN002).
      .where('account.role = :role', { role: AccountRole.User })
      .orderBy('account.name', 'ASC')
      .addOrderBy('account.id', 'ASC');

    if (filters.q !== undefined) {
      query.andWhere(
        `(account.name ILIKE :q ESCAPE '\\' OR account.email ILIKE :q ESCAPE '\\')`,
        { q: `%${escapeLike(filters.q)}%` },
      );
    }

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
