// Este arquivo testa a montagem da consulta de pacientes autorizados sem
// depender de uma conexão externa durante a execução unitária.

import { jest } from '@jest/globals';
import { Repository } from 'typeorm';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
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

describe('ACTIVE_PTS_STATES', () => {
  it('lists the planning and running PTS states', () => {
    expect(ACTIVE_PTS_STATES).toEqual([
      PtsStateEnum.PLANNING,
      PtsStateEnum.RUNNING,
    ]);
  });
});

// O filtro de autorização (`where` com PTS ativo e equipe) está desligado na
// `dev` desde o PR #68; o teste segue a consulta atual.
describe('PatientsRepository.findAuthorizedPaginated', () => {
  it('returns rows and total with pagination', async () => {
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

describe('PatientsRepository.insert', () => {
  function createInsertRepository() {
    const insertQuery = {
      insert: jest.fn(),
      into: jest.fn(),
      values: jest.fn(),
      setParameter: jest.fn(),
      execute: jest.fn<() => Promise<unknown>>(),
    };

    for (const method of [
      insertQuery.insert,
      insertQuery.into,
      insertQuery.values,
      insertQuery.setParameter,
    ]) {
      method.mockReturnValue(insertQuery);
    }

    insertQuery.execute.mockResolvedValue({});
    const typeormRepository = {
      createQueryBuilder: jest.fn(() => insertQuery),
    };
    const repository = new PatientsRepository(
      typeormRepository as unknown as Repository<Patient>,
    );

    return { insertQuery, repository };
  }

  // O TypeORM grava coluna jsonb com JSON.stringify do valor inteiro, o que
  // gera um literal inválido para jsonb[] ("malformed array literal").
  it('sends each support contact as JSON text cast to jsonb[]', async () => {
    const { insertQuery, repository } = createInsertRepository();
    const contacts = [
      { name: 'Maria Martins', email: 'maria@exemplo.com' },
      { name: 'João' },
    ];

    await repository.insert({
      accountId: 'account-1',
      supportContacts: contacts,
    });

    expect(insertQuery.into).toHaveBeenCalledWith(Patient);
    const [values] = insertQuery.values.mock.calls[0] as [
      { accountId: string; supportContacts: () => string },
    ];
    expect(values.accountId).toBe('account-1');
    expect(values.supportContacts()).toBe('CAST(:supportContacts AS jsonb[])');
    expect(insertQuery.setParameter).toHaveBeenCalledWith('supportContacts', [
      JSON.stringify(contacts[0]),
      JSON.stringify(contacts[1]),
    ]);
    expect(insertQuery.execute).toHaveBeenCalled();
  });

  it('sends an empty list when there are no support contacts', async () => {
    const { insertQuery, repository } = createInsertRepository();

    await repository.insert({ accountId: 'account-1', supportContacts: [] });

    expect(insertQuery.setParameter).toHaveBeenCalledWith(
      'supportContacts',
      [],
    );
  });

  it('propagates database errors to the caller', async () => {
    const { insertQuery, repository } = createInsertRepository();
    const failure = new Error('duplicate key value');
    insertQuery.execute.mockRejectedValue(failure);

    await expect(
      repository.insert({ accountId: 'account-1', supportContacts: [] }),
    ).rejects.toBe(failure);
  });
});
