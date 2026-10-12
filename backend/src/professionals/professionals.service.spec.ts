import { jest } from '@jest/globals';
import { Repository } from 'typeorm';
import { Professional } from '../database/entities/professional.entity';
import { Specialism } from '../database/enums/specialism.enum';
import type { GetProfessionalsRequestDto } from './dto/get-professionals-request.dto';
import { ProfessionalsService } from './professionals.service';

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

type ProfessionalRow = {
  professional_id: string;
  professional_specialism: Specialism;
  account_name: string;
  account_email: string;
};

function createService() {
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

  const repository = {
    createQueryBuilder: jest.fn(() => query),
  };
  const service = new ProfessionalsService(
    repository as unknown as Repository<Professional>,
  );

  return { query, repository, service };
}

const request: GetProfessionalsRequestDto = {
  page: 2,
  limit: 10,
  name: 'Maria',
  specialism: Specialism.Psychologist,
  ids: ['550e8400-e29b-41d4-a716-446655440000'],
};

describe('ProfessionalsService.findAll', () => {
  it('applies combined filters and returns only the public summary', async () => {
    const { query, repository, service } = createService();
    query.getCount.mockResolvedValue(11);
    query.getRawMany.mockResolvedValue([
      {
        professional_id: '550e8400-e29b-41d4-a716-446655440000',
        professional_specialism: Specialism.Psychologist,
        account_name: 'Maria Silva',
        account_email: 'maria@example.com',
      },
    ]);

    await expect(service.findAll(request)).resolves.toEqual({
      data: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Maria Silva',
          email: 'maria@example.com',
          specialism: {
            id: Specialism.Psychologist,
            name: 'Psicologia',
          },
        },
      ],
      pagination: {
        page: 2,
        limit: 10,
        total: 11,
        totalPages: 2,
      },
    });

    expect(repository.createQueryBuilder).toHaveBeenCalledWith('professional');
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
      { ids: request.ids },
    );
    expect(query.skip).toHaveBeenCalledWith(10);
    expect(query.take).toHaveBeenCalledWith(10);
  });

  it('returns an empty page when there are no matches', async () => {
    const { query, service } = createService();
    query.getCount.mockResolvedValue(0);
    query.getRawMany.mockResolvedValue([]);

    await expect(
      service.findAll({ page: 3, limit: 10 }),
    ).resolves.toMatchObject({
      data: [],
      pagination: {
        page: 3,
        limit: 10,
        total: 0,
        totalPages: 0,
      },
    });
  });

  it('returns a safe internal error when the database query fails', async () => {
    const { query, service } = createService();
    query.getCount.mockRejectedValue(new Error('database connection details'));

    await expect(service.findAll({ page: 1, limit: 10 })).rejects.toMatchObject(
      {
        response: {
          status: 'ERROR',
          message: 'Não foi possível consultar os profissionais.',
        },
      },
    );
  });
});
