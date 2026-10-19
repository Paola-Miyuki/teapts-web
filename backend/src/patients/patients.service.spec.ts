import { jest } from '@jest/globals';
import { Repository } from 'typeorm';
import { Patient } from '../database/entities/patient.entity';
import { ACTIVE_PTS_STATES, PatientsService } from './patients.service';

type PatientRow = { patient_id: string; account_name: string };

type QueryBuilderMock = {
  innerJoin: jest.Mock;
  select: jest.Mock;
  where: jest.Mock;
  orderBy: jest.Mock;
  addOrderBy: jest.Mock;
  clone: jest.Mock;
  offset: jest.Mock;
  limit: jest.Mock;
  getCount: jest.MockedFunction<() => Promise<number>>;
  getRawMany: jest.MockedFunction<() => Promise<PatientRow[]>>;
};

function createService() {
  const query: QueryBuilderMock = {
    innerJoin: jest.fn(),
    select: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    clone: jest.fn(),
    offset: jest.fn(),
    limit: jest.fn(),
    getCount: jest.fn<() => Promise<number>>(),
    getRawMany: jest.fn<() => Promise<PatientRow[]>>(),
  };

  for (const method of [
    query.innerJoin,
    query.select,
    query.where,
    query.orderBy,
    query.addOrderBy,
    query.offset,
    query.limit,
  ]) {
    method.mockReturnValue(query);
  }

  query.clone.mockReturnValue({ getCount: query.getCount });
  const repository = {
    createQueryBuilder: jest.fn(() => query),
  };
  const service = new PatientsService(
    repository as unknown as Repository<Patient>,
  );

  return { query, repository, service };
}

describe('PatientsService.findAuthorized', () => {
  it('returns only patient id and name with pagination', async () => {
    const { query, repository, service } = createService();
    query.getCount.mockResolvedValue(11);
    query.getRawMany.mockResolvedValue([
      { patient_id: 'patient-1', account_name: 'Maria Silva' },
    ]);

    await expect(
      service.findAuthorized('professional-account', { page: 2, limit: 10 }),
    ).resolves.toEqual({
      data: [{ id: 'patient-1', name: 'Maria Silva' }],
      pagination: { page: 2, limit: 10, total: 11, totalPages: 2 },
    });

    expect(repository.createQueryBuilder).toHaveBeenCalledWith('patient');
    expect(query.where).toHaveBeenCalledWith(expect.any(String), {
      accountId: 'professional-account',
      states: ACTIVE_PTS_STATES,
    });
    expect(query.orderBy).toHaveBeenCalledWith('account.name', 'ASC');
    expect(query.addOrderBy).toHaveBeenCalledWith('patient."accountId"', 'ASC');
    expect(query.offset).toHaveBeenCalledWith(10);
    expect(query.limit).toHaveBeenCalledWith(10);
  });

  it('returns an empty page with zero total pages', async () => {
    const { query, service } = createService();
    query.getCount.mockResolvedValue(0);
    query.getRawMany.mockResolvedValue([]);

    await expect(
      service.findAuthorized('account', { page: 1, limit: 10 }),
    ).resolves.toMatchObject({
      data: [],
      pagination: { total: 0, totalPages: 0 },
    });
  });

  it('hides database error details', async () => {
    const { query, service } = createService();
    query.getCount.mockRejectedValue(new Error('database connection details'));

    await expect(
      service.findAuthorized('account', { page: 1, limit: 10 }),
    ).rejects.toMatchObject({
      response: {
        status: 'ERROR',
        message: 'Não foi possível consultar os pacientes autorizados.',
      },
    });
    await expect(
      service.findAuthorized('account', { page: 1, limit: 10 }),
    ).rejects.not.toThrow('database connection details');
  });
});
