import { jest } from '@jest/globals';
import { DataSource, In, Repository } from 'typeorm';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import { Patient } from '../../patients/entities/patient.entity';
import { Professional } from '../../professionals/entities/professional.entity';
import { PtsEntity } from '../entities/pts.entity';
import { PtsRepositoryImpl } from '../repositories/pts.repository.impl';
import { expectApiError } from './test-utils';

// Substitui o QueryRunner para conferir lock, transação e rollback da decisão
// sem depender de uma conexão com o banco.
function createRepository(lockedRows: Partial<PtsEntity>[]) {
  const query = {
    setLock: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    getMany: jest.fn(async () => lockedRows),
    getOne: jest.fn(async () => lockedRows[0] ?? null),
  };

  for (const method of [query.setLock, query.where, query.orderBy]) {
    method.mockReturnValue(query);
  }

  const queryRunner = {
    isTransactionActive: false,
    manager: {
      createQueryBuilder: jest.fn(() => query),
      update: jest.fn(async () => ({ affected: 1 })),
    },
    connect: jest.fn(async () => undefined),
    startTransaction: jest.fn(async () => {
      queryRunner.isTransactionActive = true;
    }),
    commitTransaction: jest.fn(async () => {
      queryRunner.isTransactionActive = false;
    }),
    rollbackTransaction: jest.fn(async () => {
      queryRunner.isTransactionActive = false;
    }),
    release: jest.fn(async () => undefined),
  };

  const dataSource = { createQueryRunner: () => queryRunner };

  const repository = new PtsRepositoryImpl(
    dataSource as unknown as DataSource,
    {} as Repository<PtsEntity>,
    {} as Repository<Professional>,
    {} as Repository<Patient>,
  );

  return { repository, query, queryRunner };
}

const draft = (id: string): Partial<PtsEntity> => ({
  id,
  status: PtsStateEnum.DRAFT,
  patientId: 'patient-1',
});

describe('PtsRepositoryImpl.approveProposal', () => {
  it('trava os PTS do paciente e decide tudo em uma transação', async () => {
    const { repository, query, queryRunner } = createRepository([
      draft('a'),
      draft('b'),
      draft('c'),
      { id: 'd', status: PtsStateEnum.REJECTED, patientId: 'patient-1' },
    ]);

    const result = await repository.approveProposal('b', 'patient-1');

    expect(query.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(query.where).toHaveBeenCalledWith('pts.patientId = :patientId', {
      patientId: 'patient-1',
    });
    expect(query.orderBy).toHaveBeenCalledWith('pts.id');

    const [[, approvedId, approved], [, rejectedWhere, rejected]] = queryRunner
      .manager.update.mock.calls as unknown as [
      [unknown, string, Partial<PtsEntity>],
      [unknown, unknown, Partial<PtsEntity>],
    ];
    expect(approvedId).toBe('b');
    expect(approved.status).toBe(PtsStateEnum.PLANNING);
    expect(rejectedWhere).toEqual({ id: In(['a', 'c']) });
    expect(rejected.status).toBe(PtsStateEnum.REJECTED);
    expect(rejected.rejectedAt).toEqual(approved.acceptedAt);

    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
    expect(result).toEqual({
      id: 'b',
      status: PtsStateEnum.PLANNING,
      acceptedAt: (approved.acceptedAt as Date).toISOString(),
      rejectedAt: null,
    });
  });

  it('desfaz a aprovação quando a rejeição das outras falha', async () => {
    const { repository, queryRunner } = createRepository([
      draft('a'),
      draft('b'),
    ]);
    queryRunner.manager.update
      .mockResolvedValueOnce({ affected: 1 })
      .mockRejectedValueOnce(new Error('falha no banco'));

    await expect(repository.approveProposal('a', 'patient-1')).rejects.toThrow(
      'falha no banco',
    );

    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
  });

  it('não aprova proposta que saiu de DRAFT antes do lock', async () => {
    const { repository, queryRunner } = createRepository([
      { id: 'a', status: PtsStateEnum.REJECTED, patientId: 'patient-1' },
    ]);

    await expectApiError(
      () => repository.approveProposal('a', 'patient-1'),
      409,
      'PTS_NOT_DRAFT',
    );

    expect(queryRunner.manager.update).not.toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('não aprova quando outra decisão já deixou um PTS ativo', async () => {
    const { repository, queryRunner } = createRepository([
      draft('a'),
      { id: 'b', status: PtsStateEnum.PLANNING, patientId: 'patient-1' },
    ]);

    await expectApiError(
      () => repository.approveProposal('a', 'patient-1'),
      409,
      'ACTIVE_PTS_ALREADY_EXISTS',
    );

    expect(queryRunner.manager.update).not.toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });
});

describe('PtsRepositoryImpl.rejectProposal', () => {
  it('trava a proposta e rejeita só ela', async () => {
    const { repository, query, queryRunner } = createRepository([draft('a')]);

    const result = await repository.rejectProposal('a');

    expect(query.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(queryRunner.manager.update).toHaveBeenCalledTimes(1);
    expect(queryRunner.manager.update).toHaveBeenCalledWith(
      PtsEntity,
      'a',
      expect.objectContaining({ status: PtsStateEnum.REJECTED }),
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(result).toMatchObject({
      id: 'a',
      status: PtsStateEnum.REJECTED,
      acceptedAt: null,
    });
  });

  it('não rejeita proposta que saiu de DRAFT antes do lock', async () => {
    const { repository, queryRunner } = createRepository([
      { id: 'a', status: PtsStateEnum.PLANNING, patientId: 'patient-1' },
    ]);

    await expectApiError(
      () => repository.rejectProposal('a'),
      409,
      'PTS_NOT_DRAFT',
    );

    expect(queryRunner.manager.update).not.toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });
});
