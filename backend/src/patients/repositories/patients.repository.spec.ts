// Este arquivo testa a montagem da consulta de pacientes autorizados sem
// depender de uma conexão externa durante a execução unitária.

import { jest } from '@jest/globals';
import { Repository } from 'typeorm';
import { Patient } from '../entities/patient.entity';
import {
  ACTIVE_PTS_STATES,
  type AuthorizedPatientRow,
  PatientsRepository,
} from './patients.repository';

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
  getRawMany: jest.MockedFunction<() => Promise<AuthorizedPatientRow[]>>;
};

function createRepository() {
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
    getRawMany: jest.fn<() => Promise<AuthorizedPatientRow[]>>(),
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
  const typeormRepository = {
    createQueryBuilder: jest.fn(() => query),
  };
  const repository = new PatientsRepository(
    typeormRepository as unknown as Repository<Patient>,
  );

  return { query, typeormRepository, repository };
}

describe('PatientsRepository.findAuthorizedPaginated', () => {
  it('returns rows and total with authorization and pagination', async () => {
    const { query, typeormRepository, repository } = createRepository();
    const row = { patient_id: 'patient-1', account_name: 'Maria Silva' };
    query.getCount.mockResolvedValue(11);
    query.getRawMany.mockResolvedValue([row]);

    await expect(
      repository.findAuthorizedPaginated('professional-account', {
        page: 2,
        limit: 10,
      }),
    ).resolves.toEqual({ rows: [row], total: 11 });

    expect(typeormRepository.createQueryBuilder).toHaveBeenCalledWith(
      'patient',
    );
    expect(query.where).toHaveBeenCalledWith(expect.any(String), {
      accountId: 'professional-account',
      states: ACTIVE_PTS_STATES,
    });
    expect(query.orderBy).toHaveBeenCalledWith('account.name', 'ASC');
    expect(query.addOrderBy).toHaveBeenCalledWith('patient."accountId"', 'ASC');
    expect(query.offset).toHaveBeenCalledWith(10);
    expect(query.limit).toHaveBeenCalledWith(10);
  });

  it('propagates database errors to the caller', async () => {
    const { query, repository } = createRepository();
    const failure = new Error('database connection details');
    query.getCount.mockRejectedValue(failure);

    await expect(
      repository.findAuthorizedPaginated('account', { page: 1, limit: 10 }),
    ).rejects.toBe(failure);
  });
});
