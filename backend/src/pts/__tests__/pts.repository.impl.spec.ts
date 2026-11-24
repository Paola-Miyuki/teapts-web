import { jest } from '@jest/globals';
import { DataSource, In, Repository } from 'typeorm';
import { AccountStatus } from '../../accounts/enums/account-status.enum';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import { Patient } from '../../patients/entities/patient.entity';
import { Professional } from '../../professionals/entities/professional.entity';
import { PtsEntity } from '../entities/pts.entity';
import { PtsRepositoryImpl } from '../repositories/pts.repository.impl';
import { TimelineRecordEntity } from '../../timeline/entities/timeline-record.entity';
import { TimelineRecordTarget } from '../../timeline/enums/timeline-record-target.enum';
import { TimelineRecordType } from '../../timeline/enums/timeline-record-type.enum';
import { TimelineRepositoryImpl } from '../../timeline/repositories/timeline.repository.impl';
import { TimelineRecorderService } from '../../timeline/services/timeline-recorder.service';
import { expectApiError } from './test-utils';

const timelineRecorder = () =>
  new TimelineRecorderService(
    new TimelineRepositoryImpl(
      {} as Repository<TimelineRecordEntity>,
      {} as Repository<PtsEntity>,
    ),
  );

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
      insert: jest.fn(async () => undefined),
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
    timelineRecorder(),
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

describe('PtsRepositoryImpl.softDeleteProposal', () => {
  function withSoftDelete(rows: Partial<PtsEntity>[]) {
    const created = createRepository(rows);
    const softDelete = jest.fn(async () => ({ affected: 1 }));
    Object.assign(created.queryRunner.manager, { softDelete });
    return { ...created, softDelete };
  }

  it('trava a proposta e preenche só o deletedAt, em uma transação', async () => {
    const { repository, query, queryRunner, softDelete } = withSoftDelete([
      draft('a'),
    ]);

    await repository.softDeleteProposal('a');

    expect(query.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(softDelete).toHaveBeenCalledWith(PtsEntity, 'a');
    expect(queryRunner.manager.update).not.toHaveBeenCalled();
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
  });

  it('não exclui proposta aprovada antes do lock', async () => {
    const { repository, queryRunner, softDelete } = withSoftDelete([
      { id: 'a', status: PtsStateEnum.PLANNING, patientId: 'patient-1' },
    ]);

    await expectApiError(
      () => repository.softDeleteProposal('a'),
      409,
      'PTS_NOT_DRAFT',
    );

    expect(softDelete).not.toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('responde 404 quando a proposta sumiu (ou já foi excluída) antes do lock', async () => {
    const { repository, softDelete } = withSoftDelete([]);

    await expectApiError(
      () => repository.softDeleteProposal('a'),
      404,
      'PTS_NOT_FOUND',
    );
    expect(softDelete).not.toHaveBeenCalled();
  });
});

// Dublê do QueryRunner da remoção: o lock usa createQueryBuilder(PtsEntity),
// o DELETE do vínculo usa createQueryBuilder() sem argumentos.
function createTeamRepository(locked: Partial<PtsEntity> | null, affected = 1) {
  const lockQuery = {
    setLock: jest.fn(),
    where: jest.fn(),
    getOne: jest.fn(async () => locked),
  };
  lockQuery.setLock.mockReturnValue(lockQuery);
  lockQuery.where.mockReturnValue(lockQuery);

  const deleteQuery = {
    delete: jest.fn(),
    from: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    execute: jest.fn(async () => ({ affected, raw: [] })),
  };
  for (const method of [
    deleteQuery.delete,
    deleteQuery.from,
    deleteQuery.where,
    deleteQuery.andWhere,
  ]) {
    method.mockReturnValue(deleteQuery);
  }

  const reloaded = {
    id: 'pts-1',
    status: PtsStateEnum.RUNNING,
    responsible: {
      id: 'prof-10',
      specialism: 'psychologist',
      account: { name: 'Kaio Segunda Conta' },
    },
    team: [],
  };

  const queryRunner = {
    isTransactionActive: false,
    manager: {
      createQueryBuilder: jest.fn((entity?: unknown) =>
        entity ? lockQuery : deleteQuery,
      ),
      insert: jest.fn(async () => ({ identifiers: [] })),
      findOne: jest.fn(async () => reloaded),
    },
    query: jest.fn(async () => []),
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

  const repository = new PtsRepositoryImpl(
    { createQueryRunner: () => queryRunner } as unknown as DataSource,
    {} as Repository<PtsEntity>,
    {} as Repository<Professional>,
    {} as Repository<Patient>,
    timelineRecorder(),
  );

  return { repository, lockQuery, deleteQuery, queryRunner };
}

describe('PtsRepositoryImpl.removeTeamMember', () => {
  const input = {
    ptsId: 'pts-1',
    professionalId: 'prof-11',
    authorProfessionalId: 'prof-10',
    executedByAccountId: 'account-10',
    description: 'Kaio Segunda Conta removeu Ana Souza da equipe',
  };
  const running: Partial<PtsEntity> = {
    id: 'pts-1',
    status: PtsStateEnum.RUNNING,
    responsibleProfessionalId: 'prof-10',
  };

  it('trava o PTS, remove o vínculo e grava a timeline na mesma transação', async () => {
    const { repository, lockQuery, deleteQuery, queryRunner } =
      createTeamRepository(running);

    const result = await repository.removeTeamMember(input);

    expect(lockQuery.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(deleteQuery.from).toHaveBeenCalledWith(
      'professional_participating_on_therapeutic_journey',
    );
    expect(deleteQuery.where).toHaveBeenCalledWith(
      'therapeutic_journey_id = :ptsId',
      { ptsId: 'pts-1' },
    );
    expect(deleteQuery.andWhere).toHaveBeenCalledWith(
      'professional_id = :professionalId',
      { professionalId: 'prof-11' },
    );
    expect(queryRunner.manager.insert).toHaveBeenCalledWith(
      TimelineRecordEntity,
      {
        type: TimelineRecordType.MemberRemoved,
        description: 'Kaio Segunda Conta removeu Ana Souza da equipe',
        targetId: 'prof-11',
        targetType: TimelineRecordTarget.TeamMember,
        ptsId: 'pts-1',
        authorProfessionalId: 'prof-10',
        executedByAccountId: 'account-10',
      },
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
    expect(result).toEqual({
      id: 'pts-1',
      status: PtsStateEnum.RUNNING,
      responsible: {
        id: 'prof-10',
        name: 'Kaio Segunda Conta',
        specialism: { id: 'psychologist', name: 'Psicólogo' },
        registration: null,
      },
      team: [],
    });
  });

  it('desfaz a remoção quando a gravação da timeline falha', async () => {
    const { repository, queryRunner } = createTeamRepository(running);
    queryRunner.manager.insert.mockRejectedValueOnce(new Error('falha'));

    await expect(repository.removeTeamMember(input)).rejects.toThrow('falha');

    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
  });

  it.each([
    ['PTS sumiu antes do lock', null, 404, 'PTS_NOT_FOUND'],
    [
      'responsabilidade transferida antes do lock',
      { ...running, responsibleProfessionalId: 'prof-15' },
      403,
      'FORBIDDEN',
    ],
    [
      'PTS encerrado antes do lock',
      { ...running, status: PtsStateEnum.CONCLUDED },
      409,
      'PTS_NOT_ACTIVE',
    ],
  ])('não remove quando o %s', async (_label, locked, status, code) => {
    const { repository, deleteQuery, queryRunner } =
      createTeamRepository(locked);

    await expectApiError(
      () => repository.removeTeamMember(input),
      status,
      code,
    );

    expect(deleteQuery.execute).not.toHaveBeenCalled();
    expect(queryRunner.manager.insert).not.toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('não remove quem virou responsável antes do lock', async () => {
    const { repository, deleteQuery } = createTeamRepository({
      ...running,
      responsibleProfessionalId: 'prof-11',
    });

    await expectApiError(
      () =>
        repository.removeTeamMember({ ...input, authorProfessionalId: null }),
      409,
      'CANNOT_REMOVE_RESPONSIBLE',
    );
    expect(deleteQuery.execute).not.toHaveBeenCalled();
  });

  it('não grava a timeline quando o vínculo já não existia', async () => {
    const { repository, queryRunner } = createTeamRepository(running, 0);

    await expectApiError(
      () => repository.removeTeamMember(input),
      404,
      'TEAM_MEMBER_NOT_FOUND',
    );

    expect(queryRunner.manager.insert).not.toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });
});

describe('PtsRepositoryImpl.updateSheet', () => {
  const sheet = {
    caseStudyDate: '2026-10-01',
    diagnosisSummary: 'Diagnóstico em comum.',
    cid: null,
    supportLevel: 2,
    strengths: null,
    priorityNeeds: ['Comunicação'],
    socialSituation: 'Mora com a mãe.',
    vulnerabilities: null,
    comorbidities: null,
    sensoryProfile: null,
    communicationMethod: null,
    nextReviewAt: '2027-10-01',
  };
  const input = {
    ptsId: 'pts-1',
    sheet,
    authorProfessionalId: 'prof-10',
    executedByAccountId: 'account-10',
    description: 'Ficha do PTS atualizada.',
  };
  const running: Partial<PtsEntity> = {
    id: 'pts-1',
    status: PtsStateEnum.RUNNING,
  };

  it('trava o PTS, atualiza a ficha e grava pts_updated na mesma transação', async () => {
    const { repository, query, queryRunner } = createRepository([running]);

    await expect(repository.updateSheet(input)).resolves.toEqual({
      id: 'pts-1',
      ...sheet,
    });

    expect(query.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(queryRunner.manager.update).toHaveBeenCalledWith(
      PtsEntity,
      'pts-1',
      sheet,
    );
    expect(queryRunner.manager.insert).toHaveBeenCalledWith(
      TimelineRecordEntity,
      {
        type: TimelineRecordType.PtsUpdated,
        description: 'Ficha do PTS atualizada.',
        targetId: 'pts-1',
        targetType: TimelineRecordTarget.Pts,
        ptsId: 'pts-1',
        authorProfessionalId: 'prof-10',
        executedByAccountId: 'account-10',
      },
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
  });

  it('desfaz a atualização quando a gravação da timeline falha', async () => {
    const { repository, queryRunner } = createRepository([running]);
    queryRunner.manager.insert.mockRejectedValueOnce(new Error('falha'));

    await expect(repository.updateSheet(input)).rejects.toThrow('falha');

    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
  });

  it.each([
    ['PTS sumiu antes do lock', [], 404, 'PTS_NOT_FOUND'],
    [
      'PTS encerrado antes do lock',
      [{ ...running, status: PtsStateEnum.CONCLUDED }],
      409,
      'PTS_NOT_ACTIVE',
    ],
  ])('não atualiza quando o %s', async (_label, rows, status, code) => {
    const { repository, queryRunner } = createRepository(rows);

    await expectApiError(() => repository.updateSheet(input), status, code);

    expect(queryRunner.manager.update).not.toHaveBeenCalled();
    expect(queryRunner.manager.insert).not.toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });
});

describe('PtsRepositoryImpl.findExistingProfessionalIds', () => {
  it('só considera profissionais de conta ativa (RFAUT005)', async () => {
    const find = jest.fn(async () => [{ id: 'professional-1' }]);
    const repository = new PtsRepositoryImpl(
      {} as DataSource,
      {} as Repository<PtsEntity>,
      { find } as unknown as Repository<Professional>,
      {} as Repository<Patient>,
      timelineRecorder(),
    );

    await expect(
      repository.findExistingProfessionalIds(['professional-1', 'p-2']),
    ).resolves.toEqual(['professional-1']);
    expect(find).toHaveBeenCalledWith({
      where: {
        id: In(['professional-1', 'p-2']),
        account: { status: AccountStatus.Active },
      },
    });
  });
});

describe('PtsRepositoryImpl.addTeamMembers', () => {
  const input = {
    ptsId: 'pts-1',
    members: [
      {
        professionalId: 'prof-15',
        description: 'Kaio Segunda Conta adicionou Kaio Felipe à equipe',
      },
      {
        professionalId: 'prof-20',
        description: 'Kaio Segunda Conta adicionou Ana Souza à equipe',
      },
    ],
    authorProfessionalId: 'prof-10',
    executedByAccountId: 'account-10',
  };
  const planning: Partial<PtsEntity> = {
    id: 'pts-1',
    status: PtsStateEnum.PLANNING,
    responsibleProfessionalId: 'prof-10',
  };

  it('trava o PTS, cria os vínculos e grava um member_added por profissional na mesma transação', async () => {
    const { repository, lockQuery, queryRunner } =
      createTeamRepository(planning);

    const result = await repository.addTeamMembers(input);

    expect(lockQuery.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(queryRunner.query).toHaveBeenCalledTimes(2);
    expect(queryRunner.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(
        'INSERT INTO professional_participating_on_therapeutic_journey',
      ),
      ['prof-15', 'pts-1'],
    );
    expect(queryRunner.query).toHaveBeenNthCalledWith(2, expect.any(String), [
      'prof-20',
      'pts-1',
    ]);
    expect(queryRunner.manager.insert).toHaveBeenCalledTimes(2);
    expect(queryRunner.manager.insert).toHaveBeenNthCalledWith(
      1,
      TimelineRecordEntity,
      {
        type: TimelineRecordType.MemberAdded,
        description: 'Kaio Segunda Conta adicionou Kaio Felipe à equipe',
        targetId: 'prof-15',
        targetType: TimelineRecordTarget.TeamMember,
        ptsId: 'pts-1',
        authorProfessionalId: 'prof-10',
        executedByAccountId: 'account-10',
      },
    );
    expect(queryRunner.manager.insert).toHaveBeenNthCalledWith(
      2,
      TimelineRecordEntity,
      expect.objectContaining({
        type: TimelineRecordType.MemberAdded,
        targetId: 'prof-20',
      }),
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
    expect(result.id).toBe('pts-1');
  });

  it('grava o admin sem profissional atribuído (RN029)', async () => {
    const { repository, queryRunner } = createTeamRepository(planning);

    await repository.addTeamMembers({ ...input, authorProfessionalId: null });

    expect(queryRunner.manager.insert).toHaveBeenCalledWith(
      TimelineRecordEntity,
      expect.objectContaining({
        authorProfessionalId: null,
        executedByAccountId: 'account-10',
      }),
    );
  });

  it('desfaz os vínculos quando a gravação da timeline falha', async () => {
    const { repository, queryRunner } = createTeamRepository(planning);
    queryRunner.manager.insert.mockRejectedValueOnce(new Error('falha'));

    await expect(repository.addTeamMembers(input)).rejects.toThrow('falha');

    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
  });

  it.each([
    ['PTS sumiu antes do lock', null, 404, 'PTS_NOT_FOUND'],
    [
      'responsabilidade transferida antes do lock',
      { ...planning, responsibleProfessionalId: 'prof-99' },
      403,
      'FORBIDDEN',
    ],
    [
      'PTS encerrado antes do lock',
      { ...planning, status: PtsStateEnum.CONCLUDED },
      409,
      'PTS_NOT_ACTIVE',
    ],
  ])('não adiciona quando o %s', async (_label, locked, status, code) => {
    const { repository, queryRunner } = createTeamRepository(locked);

    await expectApiError(() => repository.addTeamMembers(input), status, code);

    expect(queryRunner.query).not.toHaveBeenCalled();
    expect(queryRunner.manager.insert).not.toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });
});
