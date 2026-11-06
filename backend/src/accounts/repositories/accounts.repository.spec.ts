// Este arquivo testa a montagem da listagem de contas sem depender de uma
// conexão externa durante a execução unitária.

import { jest } from '@jest/globals';
import { Repository } from 'typeorm';
import { Account } from '../entities/account.entity';
import { AccountRole } from '../enums/account-role.enum';
import { Patient } from '../../patients/entities/patient.entity';
import {
  type AccountRow,
  type AccountsQuery,
  AccountsRepository,
} from './accounts.repository';

type QueryBuilderMock = {
  select: jest.Mock;
  where: jest.Mock;
  leftJoin: jest.Mock;
  andWhere: jest.Mock;
  orderBy: jest.Mock;
  addOrderBy: jest.Mock;
  clone: jest.Mock;
  offset: jest.Mock;
  limit: jest.Mock;
  getCount: jest.MockedFunction<() => Promise<number>>;
  getRawMany: jest.MockedFunction<() => Promise<AccountRow[]>>;
};

function createRepository() {
  const query: QueryBuilderMock = {
    select: jest.fn(),
    where: jest.fn(),
    leftJoin: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    clone: jest.fn(),
    offset: jest.fn(),
    limit: jest.fn(),
    getCount: jest.fn<() => Promise<number>>(),
    getRawMany: jest.fn<() => Promise<AccountRow[]>>(),
  };

  for (const method of [
    query.select,
    query.where,
    query.leftJoin,
    query.andWhere,
    query.orderBy,
    query.addOrderBy,
    query.offset,
    query.limit,
  ]) {
    method.mockReturnValue(query);
  }

  query.clone.mockReturnValue({ getCount: query.getCount });
  query.getCount.mockResolvedValue(0);
  query.getRawMany.mockResolvedValue([]);
  const typeormRepository = {
    createQueryBuilder: jest.fn(() => query),
  };
  const repository = new AccountsRepository(
    typeormRepository as unknown as Repository<Account>,
  );

  return { query, typeormRepository, repository };
}

const firstPage: AccountsQuery = { page: 1, limit: 20 };

describe('AccountsRepository.findPaginated', () => {
  it('returns the projected rows and the total, ordered and paginated', async () => {
    const { query, typeormRepository, repository } = createRepository();
    const row = {
      account_id: 'account-1',
      account_name: 'Maria Silva',
      account_email: 'maria@exemplo.com',
    };
    query.getCount.mockResolvedValue(21);
    query.getRawMany.mockResolvedValue([row]);

    await expect(
      repository.findPaginated({ page: 2, limit: 20 }),
    ).resolves.toEqual({ rows: [row], total: 21 });

    expect(typeormRepository.createQueryBuilder).toHaveBeenCalledWith(
      'account',
    );
    expect(query.select).toHaveBeenCalledWith([
      'account.id AS account_id',
      'account.name AS account_name',
      'account.email AS account_email',
    ]);
    expect(query.orderBy).toHaveBeenCalledWith('account.name', 'ASC');
    expect(query.addOrderBy).toHaveBeenCalledWith('account.id', 'ASC');
    expect(query.clone).toHaveBeenCalled();
    expect(query.offset).toHaveBeenCalledWith(20);
    expect(query.limit).toHaveBeenCalledWith(20);
  });

  it('lists only user accounts before counting and paginating', async () => {
    const { query, repository } = createRepository();

    await repository.findPaginated(firstPage);

    expect(query.where).toHaveBeenCalledWith('account.role = :role', {
      role: AccountRole.User,
    });
    expect(query.where.mock.invocationCallOrder[0]).toBeLessThan(
      query.clone.mock.invocationCallOrder[0],
    );
    expect(query.leftJoin).not.toHaveBeenCalled();
    expect(query.andWhere).not.toHaveBeenCalled();
  });

  it.each([
    [{ q: 'ana' }],
    [{ isPatient: true }],
    [{ isProfessional: false }],
    [{ q: 'ana', isPatient: false, isProfessional: true }],
  ])('keeps admins out with the filters %j', async (filters) => {
    const { query, repository } = createRepository();

    await repository.findPaginated({ ...firstPage, ...filters });

    expect(query.where).toHaveBeenCalledTimes(1);
    expect(query.where).toHaveBeenCalledWith('account.role = :role', {
      role: AccountRole.User,
    });
  });

  it.each([
    [true, 'patient."accountId" IS NOT NULL'],
    [false, 'patient."accountId" IS NULL'],
  ])('filters isPatient=%s', async (isPatient, condition) => {
    const { query, repository } = createRepository();

    await repository.findPaginated({ ...firstPage, isPatient });

    expect(query.leftJoin).toHaveBeenCalledWith(
      Patient,
      'patient',
      'patient."accountId" = account.id',
    );
    expect(query.andWhere).toHaveBeenCalledWith(condition);
  });

  it.each([
    [true, 'EXISTS'],
    [false, 'NOT EXISTS'],
  ])('filters isProfessional=%s', async (isProfessional, operator) => {
    const { query, repository } = createRepository();

    await repository.findPaginated({ ...firstPage, isProfessional });

    expect(query.andWhere).toHaveBeenCalledWith(
      `${operator} (SELECT 1 FROM professional WHERE professional."accountId" = account.id)`,
    );
  });

  it('searches by name or email before counting and paginating', async () => {
    const { query, repository } = createRepository();

    await repository.findPaginated({ ...firstPage, q: 'Mari' });

    expect(query.andWhere).toHaveBeenCalledWith(
      `(account.name ILIKE :q ESCAPE '\\' OR account.email ILIKE :q ESCAPE '\\')`,
      { q: '%Mari%' },
    );
    expect(query.andWhere.mock.invocationCallOrder[0]).toBeLessThan(
      query.clone.mock.invocationCallOrder[0],
    );
    expect(query.andWhere.mock.invocationCallOrder[0]).toBeLessThan(
      query.offset.mock.invocationCallOrder[0],
    );
  });

  it.each([
    ['100%', '%100\\%%'],
    ['maria_silva', '%maria\\_silva%'],
    ['a\\b', '%a\\\\b%'],
  ])('treats the wildcards in %s as text', async (q, pattern) => {
    const { query, repository } = createRepository();

    await repository.findPaginated({ ...firstPage, q });

    expect(query.andWhere).toHaveBeenCalledWith(expect.any(String), {
      q: pattern,
    });
  });

  it('combines the search with the patient filter', async () => {
    const { query, repository } = createRepository();

    await repository.findPaginated({ ...firstPage, isPatient: true, q: 'ana' });

    expect(query.andWhere).toHaveBeenCalledWith(
      'patient."accountId" IS NOT NULL',
    );
    expect(query.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('ILIKE'),
      {
        q: '%ana%',
      },
    );
  });

  it('propagates database errors to the caller', async () => {
    const { query, repository } = createRepository();
    const failure = new Error('database connection details');
    query.getCount.mockRejectedValue(failure);

    await expect(repository.findPaginated(firstPage)).rejects.toBe(failure);
  });
});
