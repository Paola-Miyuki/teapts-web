// Este arquivo testa a montagem da listagem de contas sem depender de uma
// conexão externa durante a execução unitária.

import { jest } from '@jest/globals';
import { Repository } from 'typeorm';
import { Account } from '../entities/account.entity';
import { Patient } from '../../patients/entities/patient.entity';
import {
  type AccountRow,
  type AccountsQuery,
  AccountsRepository,
} from './accounts.repository';

type QueryBuilderMock = {
  select: jest.Mock;
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
    const row = { account_id: 'account-1', account_name: 'Maria Silva' };
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
    ]);
    expect(query.orderBy).toHaveBeenCalledWith('account.name', 'ASC');
    expect(query.addOrderBy).toHaveBeenCalledWith('account.id', 'ASC');
    expect(query.clone).toHaveBeenCalled();
    expect(query.offset).toHaveBeenCalledWith(20);
    expect(query.limit).toHaveBeenCalledWith(20);
  });

  it('does not filter when no filter is informed', async () => {
    const { query, repository } = createRepository();

    await repository.findPaginated(firstPage);

    expect(query.leftJoin).not.toHaveBeenCalled();
    expect(query.andWhere).not.toHaveBeenCalled();
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

  it('propagates database errors to the caller', async () => {
    const { query, repository } = createRepository();
    const failure = new Error('database connection details');
    query.getCount.mockRejectedValue(failure);

    await expect(repository.findPaginated(firstPage)).rejects.toBe(failure);
  });
});
