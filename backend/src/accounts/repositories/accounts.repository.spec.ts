// Este arquivo testa a listagem de contas e a desativação sem conexão externa.
// O SQL da listagem é gerado por um DataSource sem conexão, para conferir os
// nomes reais das colunas.

import { jest } from '@jest/globals';
import { DataSource, Repository } from 'typeorm';
import { Account } from '../entities/account.entity';
import { AccountRole } from '../enums/account-role.enum';
import { AccountStatus } from '../enums/account-status.enum';
import { Medication } from '../../patients/entities/medication.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { SupportContact } from '../../patients/entities/support-contact.entity';
import { Professional } from '../../professionals/entities/professional.entity';
import { PtsEntity } from '../../pts/entities/pts.entity';
import { TimelineRecordEntity } from '../../timeline/entities/timeline-record.entity';
import {
  type AccountRow,
  type AccountsQuery,
  AccountsRepository,
} from './accounts.repository';

const firstPage: AccountsQuery = { page: 1, limit: 20 };

let dataSource: DataSource;
let repository: AccountsRepository;

beforeAll(async () => {
  dataSource = new DataSource({
    type: 'postgres',
    entities: [
      Account,
      Patient,
      Medication,
      SupportContact,
      Professional,
      PtsEntity,
      TimelineRecordEntity,
    ],
  });
  // Só monta os metadados; não abre conexão.
  await (
    dataSource as unknown as { buildMetadatas(): Promise<void> }
  ).buildMetadatas();
  repository = new AccountsRepository(dataSource.getRepository(Account));
});

function sqlOf(filters: Partial<AccountsQuery> = {}) {
  const query = repository.buildListQuery({ ...firstPage, ...filters });

  return { sql: query.getQuery(), params: query.getParameters() };
}

describe('AccountsRepository.buildListQuery', () => {
  it('never uses a camelCase column name in the raw SQL', () => {
    const { sql } = sqlOf({
      q: 'ana',
      isPatient: true,
      isProfessional: false,
      profile: ['none', 'patient', 'professional', 'admin'],
      status: AccountStatus.Active,
      createdFrom: '2026-10-01',
      createdTo: '2026-11-24',
      sort: 'createdAt',
      order: 'desc',
    });

    expect(sql).not.toContain('"accountId"');
    expect(sql).not.toMatch(/\b(accountId|socialName|createdAt)\b/);
    expect(sql).toContain('patient.account_id = "account"."id"');
    expect(sql).toContain('professional.account_id = "account"."id"');
  });

  it('lists every account, admins included, ordered by display name', () => {
    const { sql } = sqlOf();

    expect(sql).toContain('WHERE 1 = 1');
    expect(sql).not.toContain('"account"."role" = $');
    expect(sql).toContain(
      `ORDER BY COALESCE(NULLIF("account"."social_name", ''), "account"."name") ASC, "account"."id" ASC`,
    );
  });

  it('projects the public columns, the profile and the specialisms', () => {
    const { sql } = sqlOf();

    for (const alias of [
      'account_id',
      'account_name',
      'account_social_name',
      'account_email',
      'account_cpf',
      'account_role',
      'account_status',
      'account_created_at',
      'account_profile',
      'account_specialisms',
    ]) {
      expect(sql).toMatch(new RegExp(`AS "?${alias}"?[,\\s]`));
    }
    expect(sql).toContain('array_agg(professional.specialism::text');
  });

  it.each([
    [{ isPatient: true }],
    [{ isProfessional: false }],
    [{ isPatient: false, isProfessional: false }],
  ])('keeps admins out with the legacy filters %j', (filters) => {
    const { sql, params } = sqlOf(filters);

    expect(sql).toContain('"account"."role" = :role');
    expect(params).toMatchObject({ role: AccountRole.User });
  });

  it('keeps the legacy combobox filters on user accounts without a profile', () => {
    const { sql } = sqlOf({ isPatient: false, isProfessional: false });

    expect(sql).toContain(
      'NOT EXISTS (SELECT 1 FROM patient WHERE patient.account_id = "account"."id")',
    );
    expect(sql).toContain(
      'NOT EXISTS (SELECT 1 FROM professional WHERE professional.account_id = "account"."id")',
    );
  });

  it('searches name, social name, email and cpf with escaped wildcards', () => {
    const { sql, params } = sqlOf({ q: '100%_\\a' });

    for (const column of [
      '"account"."name"',
      '"account"."social_name"',
      '"account"."email"',
      '"account"."cpf"',
    ]) {
      expect(sql).toContain(`${column} ILIKE :term ESCAPE`);
    }
    expect(sql).not.toContain('regexp_replace');
    expect(params).toMatchObject({ term: '%100\\%\\_\\\\a%' });
  });

  it.each(['529.982.247-25', '529982', '  '])(
    'also compares the cpf digits when the search %j looks numeric',
    (q) => {
      const { sql, params } = sqlOf({ q });

      if (q.trim() === '') {
        expect(sql).not.toContain('regexp_replace');
        return;
      }

      expect(sql).toContain(
        `regexp_replace("account"."cpf", '\\D', '', 'g') LIKE :digits`,
      );
      expect(params).toMatchObject({ digits: `%${q.replace(/\D/g, '')}%` });
    },
  );

  it('ORs the selected profiles', () => {
    const { sql } = sqlOf({ profile: ['none', 'admin'] });

    expect(sql).toContain(`"account"."role" = 'user' AND NOT EXISTS`);
    expect(sql).toContain(`) OR "account"."role" = 'admin'`);
  });

  it('filters by status and by the inclusive creation range', () => {
    const { sql, params } = sqlOf({
      status: AccountStatus.Inactive,
      createdFrom: '2026-10-01',
      createdTo: '2026-11-24',
    });

    expect(sql).toContain('"account"."status" = :status');
    expect(sql).toContain(
      '"account"."created_at" >= CAST(:createdFrom AS date)',
    );
    expect(sql).toContain(
      '"account"."created_at" < CAST(:createdTo AS date) + 1',
    );
    expect(params).toMatchObject({
      status: AccountStatus.Inactive,
      createdFrom: '2026-10-01',
      createdTo: '2026-11-24',
    });
  });

  it.each([
    [
      { sort: 'name', order: 'desc' },
      /ORDER BY COALESCE\(.*\) DESC, "account"."id" ASC/,
    ],
    [
      { sort: 'createdAt' },
      /ORDER BY "account"."created_at" ASC, COALESCE\(.*\) ASC/,
    ],
    [
      { sort: 'createdAt', order: 'desc' },
      /ORDER BY "account"."created_at" DESC/,
    ],
  ] as const)('orders by %j', (filters, pattern) => {
    expect(sqlOf(filters).sql).toMatch(pattern);
  });
});

describe('AccountsRepository.findPaginated', () => {
  function stubQuery() {
    const query = {
      clone: jest.fn(),
      offset: jest.fn(),
      limit: jest.fn(),
      getCount: jest.fn<() => Promise<number>>().mockResolvedValue(21),
      getRawMany: jest.fn<() => Promise<AccountRow[]>>().mockResolvedValue([]),
    };
    query.clone.mockReturnValue({ getCount: query.getCount });
    query.offset.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    jest
      .spyOn(repository, 'buildListQuery')
      .mockReturnValue(
        query as unknown as ReturnType<typeof repository.buildListQuery>,
      );

    return query;
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('counts before paginating and returns the rows with the total', async () => {
    const query = stubQuery();
    const row = { account_id: 'account-1' } as AccountRow;
    query.getRawMany.mockResolvedValue([row]);

    await expect(
      repository.findPaginated({ page: 2, limit: 20 }),
    ).resolves.toEqual({ rows: [row], total: 21 });

    expect(query.clone.mock.invocationCallOrder[0]).toBeLessThan(
      query.offset.mock.invocationCallOrder[0],
    );
    expect(query.offset).toHaveBeenCalledWith(20);
    expect(query.limit).toHaveBeenCalledWith(20);
  });

  it('propagates database errors to the caller', async () => {
    const query = stubQuery();
    const failure = new Error('database connection details');
    query.getCount.mockRejectedValue(failure);

    await expect(repository.findPaginated(firstPage)).rejects.toBe(failure);
  });
});

describe('AccountsRepository.deactivate', () => {
  const accountId = 'account-1';
  const adminId = 'admin-1';

  function setup(account: Partial<Account> | null, responsibleRows: unknown[]) {
    const lockQuery = {
      setLock: jest.fn(),
      where: jest.fn(),
      getOne: jest.fn(async () => account),
    };
    lockQuery.setLock.mockReturnValue(lockQuery);
    lockQuery.where.mockReturnValue(lockQuery);
    const manager = {
      createQueryBuilder: jest.fn(() => lockQuery),
      query: jest.fn(async (sql: string) =>
        sql.startsWith('SELECT') ? responsibleRows : undefined,
      ),
      update: jest.fn(async () => undefined),
    };
    const typeormRepository = {
      manager: {
        transaction: jest.fn(
          async (work: (entityManager: unknown) => Promise<unknown>) =>
            work(manager),
        ),
      },
    };
    const repository = new AccountsRepository(
      typeormRepository as unknown as Repository<Account>,
    );

    return { manager, lockQuery, repository };
  }

  it('locks the account, records the deactivation and leaves the active teams', async () => {
    const { manager, lockQuery, repository } = setup(
      {
        id: accountId,
        status: AccountStatus.Active,
        supertokensUserId: 'st-1',
      },
      [],
    );

    const result = await repository.deactivate(accountId, adminId);

    expect(lockQuery.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(result).toEqual({
      outcome: 'deactivated',
      supertokensUserId: 'st-1',
      deactivatedAt: expect.any(Date),
    });
    expect(manager.update).toHaveBeenCalledWith(
      Account,
      { id: accountId },
      {
        status: AccountStatus.Inactive,
        deactivatedAt: (result as { deactivatedAt: Date }).deactivatedAt,
        deactivatedByAccountId: adminId,
      },
    );
    const [deleteSql, deleteParams] = manager.query.mock
      .calls[1] as unknown as [string, unknown[]];
    expect(deleteSql).toContain(
      'DELETE FROM professional_participating_on_therapeutic_journey',
    );
    expect(deleteParams).toEqual([accountId, ['planning', 'running']]);
  });

  it('reports a missing account without writing', async () => {
    const { manager, repository } = setup(null, []);

    await expect(repository.deactivate(accountId, adminId)).resolves.toEqual({
      outcome: 'not_found',
    });
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('reports an account that is already inactive without writing', async () => {
    const { manager, repository } = setup(
      { id: accountId, status: AccountStatus.Inactive },
      [],
    );

    await expect(repository.deactivate(accountId, adminId)).resolves.toEqual({
      outcome: 'already_deactivated',
    });
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('blocks a profile that is responsible for an active PTS without writing', async () => {
    const { manager, repository } = setup(
      { id: accountId, status: AccountStatus.Active },
      [{ '?column?': 1 }],
    );

    await expect(repository.deactivate(accountId, adminId)).resolves.toEqual({
      outcome: 'pts_responsible',
    });
    expect(manager.update).not.toHaveBeenCalled();
    expect(manager.query).toHaveBeenCalledTimes(1);
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT'),
      [accountId, ['planning', 'running']],
    );
  });
});
