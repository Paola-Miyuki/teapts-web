import { jest } from '@jest/globals';
import { Repository } from 'typeorm';
import { Account } from '../../accounts/entities/account.entity';
import { Professional } from '../entities/professional.entity';
import { Specialism } from '../enums/specialism.enum';
import {
  type FindProfessionalsQuery,
  type ProfessionalRow,
  ProfessionalsRepository,
} from './professionals.repository';

// O teste substitui somente o QueryBuilder para validar filtros e paginação
// sem depender de uma conexão externa durante a execução unitária.
type QueryBuilderMock = {
  innerJoin: jest.Mock;
  select: jest.Mock;
  andWhere: jest.Mock;
  orderBy: jest.Mock;
  addOrderBy: jest.Mock;
  clone: jest.Mock;
  skip: jest.Mock;
  take: jest.Mock;
  getCount: jest.MockedFunction<() => Promise<number>>;
  getRawMany: jest.MockedFunction<() => Promise<ProfessionalRow[]>>;
};

function createRepository() {
  const query: QueryBuilderMock = {
    innerJoin: jest.fn(),
    select: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    clone: jest.fn(),
    skip: jest.fn(),
    take: jest.fn(),
    getCount: jest.fn<() => Promise<number>>(),
    getRawMany: jest.fn<() => Promise<ProfessionalRow[]>>(),
  };

  for (const method of [
    query.innerJoin,
    query.select,
    query.andWhere,
    query.orderBy,
    query.addOrderBy,
    query.skip,
    query.take,
  ]) {
    method.mockReturnValue(query);
  }

  const countQuery = {
    getCount: query.getCount,
  };
  query.clone.mockReturnValue(countQuery);

  const typeormRepository = {
    createQueryBuilder: jest.fn(() => query),
  };
  const repository = new ProfessionalsRepository(
    typeormRepository as unknown as Repository<Professional>,
  );

  return { query, typeormRepository, repository };
}

const filters: FindProfessionalsQuery = {
  page: 2,
  limit: 10,
  name: 'Maria',
  specialism: Specialism.Psychologist,
  ids: ['550e8400-e29b-41d4-a716-446655440000'],
};

const row: ProfessionalRow = {
  professional_id: '550e8400-e29b-41d4-a716-446655440000',
  professional_specialism: Specialism.Psychologist,
  account_name: 'Maria Silva',
  account_email: 'maria@example.com',
};

describe('ProfessionalsRepository.findPaginated', () => {
  it('applies combined filters, ordering and pagination', async () => {
    const { query, typeormRepository, repository } = createRepository();
    query.getCount.mockResolvedValue(11);
    query.getRawMany.mockResolvedValue([row]);

    await expect(repository.findPaginated(filters)).resolves.toEqual({
      rows: [row],
      total: 11,
    });

    expect(typeormRepository.createQueryBuilder).toHaveBeenCalledWith(
      'professional',
    );
    expect(query.innerJoin).toHaveBeenCalledWith(
      Account,
      'account',
      'account.id = professional."accountId"',
    );
    expect(query.select).toHaveBeenCalledWith([
      'professional.id AS professional_id',
      'professional.specialism AS professional_specialism',
      'account.name AS account_name',
      'account.email AS account_email',
    ]);
    expect(query.andWhere).toHaveBeenCalledWith(
      'LOWER(account.name) LIKE LOWER(:name)',
      { name: '%Maria%' },
    );
    expect(query.andWhere).toHaveBeenCalledWith(
      'professional.specialism = :specialism',
      { specialism: Specialism.Psychologist },
    );
    expect(query.andWhere).toHaveBeenCalledWith(
      'professional.id IN (:...ids)',
      { ids: filters.ids },
    );
    expect(query.orderBy).toHaveBeenCalledWith('account.name', 'ASC');
    expect(query.addOrderBy).toHaveBeenCalledWith('professional.id', 'ASC');
    expect(query.clone).toHaveBeenCalled();
    expect(query.skip).toHaveBeenCalledWith(10);
    expect(query.take).toHaveBeenCalledWith(10);
  });

  it('does not filter when no filter is informed', async () => {
    const { query, repository } = createRepository();
    query.getCount.mockResolvedValue(0);
    query.getRawMany.mockResolvedValue([]);

    await expect(
      repository.findPaginated({ page: 1, limit: 10 }),
    ).resolves.toEqual({ rows: [], total: 0 });

    expect(query.andWhere).not.toHaveBeenCalled();
    expect(query.skip).toHaveBeenCalledWith(0);
  });

  it('propagates database errors to the caller', async () => {
    const { query, repository } = createRepository();
    const failure = new Error('database connection details');
    query.getCount.mockRejectedValue(failure);

    await expect(repository.findPaginated(filters)).rejects.toBe(failure);
  });
});
