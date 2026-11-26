import { jest } from '@jest/globals';
import { Repository } from 'typeorm';
import { Account } from '../../accounts/entities/account.entity';
import { AccountStatus } from '../../accounts/enums/account-status.enum';
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
  offset: jest.Mock;
  limit: jest.Mock;
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
    offset: jest.fn(),
    limit: jest.fn(),
    getCount: jest.fn<() => Promise<number>>(),
    getRawMany: jest.fn<() => Promise<ProfessionalRow[]>>(),
  };

  for (const method of [
    query.innerJoin,
    query.select,
    query.andWhere,
    query.orderBy,
    query.addOrderBy,
    query.offset,
    query.limit,
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
  q: 'Maria',
  specialism: [Specialism.Psychologist],
  councilState: 'pr',
  ids: ['550e8400-e29b-41d4-a716-446655440000'],
};

const row: ProfessionalRow = {
  professional_id: '550e8400-e29b-41d4-a716-446655440000',
  professional_account_id: '6f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f',
  professional_specialism: Specialism.Psychologist,
  professional_council_number: '12345',
  professional_council_state: 'pr',
  professional_institution: 'IMA',
  professional_cnes: null,
  account_name: 'Maria Silva',
  account_email: 'maria@example.com',
  account_status: AccountStatus.Active,
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
      'account.id = professional.accountId',
    );
    expect(query.select).toHaveBeenCalledWith([
      'professional.id AS professional_id',
      'professional.accountId AS professional_account_id',
      'professional.specialism AS professional_specialism',
      'professional.councilNumber AS professional_council_number',
      'professional.councilState AS professional_council_state',
      'professional.institution AS professional_institution',
      'professional.cnes AS professional_cnes',
      'account.name AS account_name',
      'account.email AS account_email',
      'account.status AS account_status',
    ]);
    expect(query.andWhere).toHaveBeenCalledWith(
      'account.status = :activeStatus',
      { activeStatus: AccountStatus.Active },
    );
    expect(query.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('account.email ILIKE :q'),
      { q: '%Maria%' },
    );
    expect(query.andWhere).toHaveBeenCalledWith(
      'professional.specialism IN (:...specialisms)',
      { specialisms: [Specialism.Psychologist] },
    );
    expect(query.andWhere).toHaveBeenCalledWith(
      'professional.councilState = :councilState',
      { councilState: 'pr' },
    );
    expect(query.andWhere).toHaveBeenCalledWith(
      'professional.id IN (:...ids)',
      { ids: filters.ids },
    );
    expect(query.orderBy).toHaveBeenCalledWith('account.name', 'ASC');
    expect(query.addOrderBy).toHaveBeenCalledWith('professional.id', 'ASC');
    expect(query.clone).toHaveBeenCalled();
    expect(query.offset).toHaveBeenCalledWith(10);
    expect(query.limit).toHaveBeenCalledWith(10);
  });

  it('searches name, email and council number with escaped wildcards', async () => {
    const { query, repository } = createRepository();
    query.getCount.mockResolvedValue(0);
    query.getRawMany.mockResolvedValue([]);

    await repository.findPaginated({ page: 1, limit: 10, q: '50%_a\\' });

    const [sql, params] = query.andWhere.mock.calls[1] as [string, object];
    expect(sql).toContain('account.name ILIKE :q');
    expect(sql).toContain('account.email ILIKE :q');
    expect(sql).toContain('professional.councilNumber ILIKE :q');
    expect(sql).toContain("ESCAPE '\\'");
    expect(params).toEqual({ q: '%50\\%\\_a\\\\%' });
  });

  it('maps councils to specialisms and intersects with the specialism filter', async () => {
    const { query, repository } = createRepository();
    query.getCount.mockResolvedValue(0);
    query.getRawMany.mockResolvedValue([]);

    await repository.findPaginated({
      page: 1,
      limit: 10,
      council: ['CRP', 'CRM'],
      specialism: [Specialism.Doctor, Specialism.Physiotherapist],
    });

    expect(query.andWhere).toHaveBeenCalledWith(
      'professional.specialism IN (:...specialisms)',
      { specialisms: [Specialism.Doctor] },
    );
  });

  it('returns nothing when council and specialism do not intersect', async () => {
    const { query, repository } = createRepository();
    query.getCount.mockResolvedValue(0);
    query.getRawMany.mockResolvedValue([]);

    await repository.findPaginated({
      page: 1,
      limit: 10,
      council: ['CRP'],
      specialism: [Specialism.Doctor],
    });

    expect(query.andWhere).toHaveBeenCalledWith('1 = 0');
  });

  it.each([
    [{}, 'account.name', 'ASC'],
    [{ order: 'desc' as const }, 'account.name', 'DESC'],
    [{ sort: 'name' as const, order: 'desc' as const }, 'account.name', 'DESC'],
  ])('orders by name (%j)', async (sorting, column, direction) => {
    const { query, repository } = createRepository();
    query.getCount.mockResolvedValue(0);
    query.getRawMany.mockResolvedValue([]);

    await repository.findPaginated({ page: 1, limit: 10, ...sorting });

    expect(query.orderBy).toHaveBeenCalledWith(column, direction);
    expect(query.addOrderBy).toHaveBeenCalledWith('professional.id', 'ASC');
  });

  it('orders by specialism name, then by account name', async () => {
    const { query, repository } = createRepository();
    query.getCount.mockResolvedValue(0);
    query.getRawMany.mockResolvedValue([]);

    await repository.findPaginated({
      page: 1,
      limit: 10,
      sort: 'specialism',
      order: 'desc',
    });

    expect(query.orderBy).toHaveBeenCalledWith(
      expect.stringContaining("WHEN 'doctor' THEN 'Médico'"),
      'DESC',
    );
    expect(query.addOrderBy).toHaveBeenCalledWith('account.name', 'ASC');
  });

  it('does not filter when no filter is informed', async () => {
    const { query, repository } = createRepository();
    query.getCount.mockResolvedValue(0);
    query.getRawMany.mockResolvedValue([]);

    await expect(
      repository.findPaginated({ page: 1, limit: 10 }),
    ).resolves.toEqual({ rows: [], total: 0 });

    expect(query.andWhere).toHaveBeenCalledTimes(1);
    expect(query.andWhere).toHaveBeenCalledWith(
      'account.status = :activeStatus',
      { activeStatus: AccountStatus.Active },
    );
    expect(query.offset).toHaveBeenCalledWith(0);
  });

  it('filters by account status for the admin, without the default active filter', async () => {
    const { query, repository } = createRepository();
    query.getCount.mockResolvedValue(0);
    query.getRawMany.mockResolvedValue([]);

    await repository.findPaginated({
      page: 1,
      limit: 10,
      includeInactive: true,
      status: [AccountStatus.Inactive],
    });

    expect(query.andWhere).toHaveBeenCalledTimes(1);
    expect(query.andWhere).toHaveBeenCalledWith(
      'account.status IN (:...statuses)',
      { statuses: [AccountStatus.Inactive] },
    );
  });

  it('keeps the inactive accounts for the admin', async () => {
    const { query, repository } = createRepository();
    query.getCount.mockResolvedValue(0);
    query.getRawMany.mockResolvedValue([]);

    await repository.findPaginated({
      page: 1,
      limit: 10,
      includeInactive: true,
    });

    expect(query.andWhere).not.toHaveBeenCalled();
  });

  it('propagates database errors to the caller', async () => {
    const { query, repository } = createRepository();
    const failure = new Error('database connection details');
    query.getCount.mockRejectedValue(failure);

    await expect(repository.findPaginated(filters)).rejects.toBe(failure);
  });
});

describe('ProfessionalsRepository.insert', () => {
  function createInsertRepository() {
    const typeormRepository = {
      insert:
        jest.fn<
          (
            values: Pick<Professional, 'accountId' | 'specialism'>,
          ) => Promise<{ identifiers: { id: string }[] }>
        >(),
    };
    const repository = new ProfessionalsRepository(
      typeormRepository as unknown as Repository<Professional>,
    );

    return { typeormRepository, repository };
  }

  const newProfile = {
    accountId: 'account-1',
    specialism: Specialism.Doctor,
    councilNumber: '6789',
    councilState: 'pr' as const,
    institution: 'CAPSi Boa Vista',
    cnes: '1234567',
    createdByAccountId: 'admin-1',
  };

  it('saves the profile linked to the account and returns the generated id', async () => {
    const { typeormRepository, repository } = createInsertRepository();
    typeormRepository.insert.mockResolvedValue({
      identifiers: [{ id: 'professional-1' }],
    });

    await expect(repository.insert(newProfile)).resolves.toBe('professional-1');

    expect(typeormRepository.insert).toHaveBeenCalledWith(newProfile);
  });

  it('propagates database errors to the caller', async () => {
    const { typeormRepository, repository } = createInsertRepository();
    const failure = new Error('duplicate key value');
    typeormRepository.insert.mockRejectedValue(failure);

    await expect(repository.insert(newProfile)).rejects.toBe(failure);
  });
});

describe('ProfessionalsRepository.findById', () => {
  function createFindRepository() {
    const typeormRepository = {
      findOne: jest.fn<(options: unknown) => Promise<Professional | null>>(),
    };
    const repository = new ProfessionalsRepository(
      typeormRepository as unknown as Repository<Professional>,
    );

    return { typeormRepository, repository };
  }

  it('loads the profile with its account', async () => {
    const { typeormRepository, repository } = createFindRepository();
    const professional = { id: 'professional-1' } as Professional;
    typeormRepository.findOne.mockResolvedValue(professional);

    await expect(repository.findById('professional-1')).resolves.toBe(
      professional,
    );

    expect(typeormRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'professional-1' },
      relations: { account: true },
    });
  });
});

describe('ProfessionalsRepository.update', () => {
  function createUpdateRepository() {
    const typeormRepository = {
      update: jest.fn<(id: string, values: unknown) => Promise<unknown>>(),
    };
    const repository = new ProfessionalsRepository(
      typeormRepository as unknown as Repository<Professional>,
    );

    return { typeormRepository, repository };
  }

  const changes = {
    specialism: Specialism.Nurse,
    councilNumber: '6789',
    councilState: 'pr' as const,
  };

  it('saves the specialism and the registration and stamps updated_at', async () => {
    const { typeormRepository, repository } = createUpdateRepository();
    typeormRepository.update.mockResolvedValue({});

    await repository.update('professional-1', changes);

    expect(typeormRepository.update).toHaveBeenCalledWith('professional-1', {
      ...changes,
      updatedAt: expect.any(Date),
    });
  });

  it('propagates database errors to the caller', async () => {
    const { typeormRepository, repository } = createUpdateRepository();
    const failure = new Error('connection lost');
    typeormRepository.update.mockRejectedValue(failure);

    await expect(repository.update('professional-1', changes)).rejects.toBe(
      failure,
    );
  });
});
