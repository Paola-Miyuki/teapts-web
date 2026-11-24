import { jest } from '@jest/globals';
import { Brackets, type EntityManager, type Repository } from 'typeorm';

import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import type { PtsEntity } from '../../pts/entities/pts.entity';
import { TimelineRecordEntity } from '../entities/timeline-record.entity';
import { TimelineRecordTarget } from '../enums/timeline-record-target.enum';
import { TimelineRecordType } from '../enums/timeline-record-type.enum';
import { TimelineRepositoryImpl } from '../repositories/timeline.repository.impl';

// Dublê do SelectQueryBuilder: cada método devolve o próprio builder, e o
// getManyAndCount devolve as linhas do teste.
function createQuery(records: Partial<TimelineRecordEntity>[], total: number) {
  const query = {
    innerJoinAndSelect: jest.fn(),
    leftJoinAndSelect: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    skip: jest.fn(),
    take: jest.fn(),
    getManyAndCount: jest.fn(async () => [records, total]),
  };

  for (const method of [
    query.innerJoinAndSelect,
    query.leftJoinAndSelect,
    query.where,
    query.andWhere,
    query.orderBy,
    query.addOrderBy,
    query.skip,
    query.take,
  ]) {
    method.mockReturnValue(query);
  }

  return query;
}

function createRepository(
  records: Partial<TimelineRecordEntity>[] = [],
  total = records.length,
) {
  const query = createQuery(records, total);
  const insert = jest.fn(async () => ({ identifiers: [] }));
  const findOne = jest.fn(async (): Promise<Partial<PtsEntity> | null> => null);

  const timelineRepository = {
    createQueryBuilder: jest.fn(() => query),
    manager: { insert },
  };
  const ptsRepository = { findOne };

  const repository = new TimelineRepositoryImpl(
    timelineRepository as unknown as Repository<TimelineRecordEntity>,
    ptsRepository as unknown as Repository<PtsEntity>,
  );

  return { repository, query, insert, findOne, timelineRepository };
}

const baseInput = { ptsId: 'pts-1', page: 1, limit: 20 };

/** Texto dos `andWhere` simples (os de Brackets aparecem como objeto). */
function conditions(query: ReturnType<typeof createQuery>) {
  return query.andWhere.mock.calls.map(([condition, parameters]) => [
    condition instanceof Brackets ? 'Brackets' : condition,
    parameters,
  ]);
}

describe('TimelineRepositoryImpl.insert', () => {
  const record = {
    ptsId: 'pts-1',
    type: TimelineRecordType.MemberRemoved,
    description: 'Kaio Segunda Conta removeu Ana Souza da equipe',
    targetId: 'prof-11',
    targetType: TimelineRecordTarget.TeamMember,
    authorProfessionalId: 'prof-10',
    executedByAccountId: 'acc-1',
  };

  it('grava pelo manager da transação recebida', async () => {
    const { repository, insert } = createRepository();
    const managerInsert = jest.fn(async () => ({ identifiers: [] }));

    await repository.insert(record, {
      insert: managerInsert,
    } as unknown as EntityManager);

    expect(managerInsert).toHaveBeenCalledWith(TimelineRecordEntity, record);
    expect(insert).not.toHaveBeenCalled();
  });

  it('sem transação, grava pelo manager do repositório', async () => {
    const { repository, insert } = createRepository();

    await repository.insert(record);

    expect(insert).toHaveBeenCalledWith(TimelineRecordEntity, record);
  });
});

describe('TimelineRepositoryImpl.findPtsAccess', () => {
  it('devolve o status, o paciente, o responsável e a equipe', async () => {
    const { repository, findOne } = createRepository();
    findOne.mockResolvedValueOnce({
      id: 'pts-1',
      status: PtsStateEnum.RUNNING,
      patientId: 'acc-patient',
      responsibleProfessionalId: 'prof-10',
      team: [{ id: 'prof-11' }, { id: 'prof-12' }] as PtsEntity['team'],
    });

    await expect(repository.findPtsAccess('pts-1')).resolves.toEqual({
      id: 'pts-1',
      status: PtsStateEnum.RUNNING,
      patientId: 'acc-patient',
      responsibleProfessionalId: 'prof-10',
      teamProfessionalIds: ['prof-11', 'prof-12'],
    });
    expect(findOne).toHaveBeenCalledWith({
      where: { id: 'pts-1' },
      relations: { team: true },
    });
  });

  it('devolve null quando o PTS não existe (ou foi excluído)', async () => {
    const { repository } = createRepository();

    await expect(repository.findPtsAccess('pts-1')).resolves.toBeNull();
  });
});

describe('TimelineRepositoryImpl.findByPts', () => {
  it('filtra pelo PTS e ordena do mais recente ao mais antigo, paginado', async () => {
    const { repository, query } = createRepository([], 0);

    await repository.findByPts({ ...baseInput, page: 3, limit: 10 });

    expect(query.where).toHaveBeenCalledWith('record.ptsId = :ptsId', {
      ptsId: 'pts-1',
    });
    expect(query.orderBy).toHaveBeenCalledWith('record.happenedAt', 'DESC');
    expect(query.addOrderBy).toHaveBeenCalledWith('record.id', 'DESC');
    expect(query.skip).toHaveBeenCalledWith(20);
    expect(query.take).toHaveBeenCalledWith(10);
    expect(query.andWhere).not.toHaveBeenCalled();
  });

  it('aplica a busca com os curingas escapados, o tipo, o autor e o período', async () => {
    const { repository, query } = createRepository([], 0);

    await repository.findByPts({
      ...baseInput,
      q: '50%_off',
      types: [TimelineRecordTarget.Activity, TimelineRecordTarget.Document],
      authorId: 'acc-2',
      from: '2026-11-01',
      to: '2026-11-30',
    });

    expect(conditions(query)).toEqual([
      ['Brackets', { term: '%50\\%\\_off%' }],
      ['record.targetType IN (:...types)', { types: ['activity', 'document'] }],
      ['Brackets', { authorId: 'acc-2' }],
      ['record.happenedAt >= CAST(:from AS date)', { from: '2026-11-01' }],
      ['record.happenedAt < CAST(:to AS date) + 1', { to: '2026-11-30' }],
    ]);
  });

  it('ordena do mais antigo ao mais recente com order=asc', async () => {
    const { repository, query } = createRepository([], 0);

    await repository.findByPts({ ...baseInput, order: 'asc' });

    expect(query.orderBy).toHaveBeenCalledWith('record.happenedAt', 'ASC');
    expect(query.addOrderBy).toHaveBeenCalledWith('record.id', 'ASC');
  });

  it('filtra o autor por quem executou: a conta ou o perfil profissional dela', async () => {
    const { repository, query } = createRepository([], 0);

    await repository.findByPts({ ...baseInput, authorId: 'prof-11' });

    const [brackets] = query.andWhere.mock.calls[0] as unknown as [Brackets];
    const where = { where: jest.fn(), orWhere: jest.fn() };
    where.where.mockReturnValue(where);
    where.orWhere.mockReturnValue(where);
    brackets.whereFactory(where as never);

    expect(where.where).toHaveBeenCalledWith(
      'record.executedByAccountId = :authorId',
    );
    expect(where.orWhere).toHaveBeenCalledTimes(1);
    expect(where.orWhere).toHaveBeenCalledWith(
      expect.stringContaining(
        'record.executedByAccountId IN (SELECT author.account_id FROM professional author WHERE author.id = :authorId)',
      ),
    );
  });

  it('monta autor e "Atribuído a" (RN029) com o nome exibido', async () => {
    const happenedAt = new Date('2026-11-12T14:45:00.000Z');
    const { repository } = createRepository(
      [
        {
          id: 'rec-1',
          type: TimelineRecordType.PtsCreated,
          targetType: TimelineRecordTarget.Pts,
          targetId: 'pts-1',
          description: 'Kaio criou o PTS e atribuiu Ana Souza como responsável',
          happenedAt,
          executedByAccountId: 'acc-admin',
          executedBy: { name: 'Kaio Admin', socialName: null } as never,
          authorProfessional: {
            id: 'prof-10',
            accountId: 'acc-ana',
            account: { name: 'Ana Maria Souza', socialName: 'Ana Souza' },
          } as never,
        },
        {
          id: 'rec-2',
          type: TimelineRecordType.ActivityApproved,
          targetType: TimelineRecordTarget.Activity,
          targetId: 'act-1',
          description: 'João Lima aprovou a atividade Integração sensorial',
          happenedAt,
          executedByAccountId: 'acc-joao',
          executedBy: { name: 'João Lima', socialName: '  ' } as never,
          authorProfessional: {
            id: 'prof-11',
            accountId: 'acc-joao',
            account: { name: 'João Lima', socialName: null },
          } as never,
        },
        {
          id: 'rec-3',
          type: TimelineRecordType.MemberRemoved,
          targetType: TimelineRecordTarget.TeamMember,
          targetId: 'prof-12',
          description: 'Kaio Segunda Conta removeu Ana Souza da equipe',
          happenedAt,
          executedByAccountId: 'acc-admin',
          executedBy: { name: 'Kaio Admin', socialName: null } as never,
          authorProfessional: null,
        },
      ],
      3,
    );

    const result = await repository.findByPts(baseInput);

    expect(result.total).toBe(3);
    expect(result.rows.map((row) => [row.author, row.assignedTo])).toEqual([
      [
        { id: 'acc-admin', name: 'Kaio Admin' },
        { id: 'prof-10', name: 'Ana Souza' },
      ],
      [{ id: 'acc-joao', name: 'João Lima' }, null],
      [{ id: 'acc-admin', name: 'Kaio Admin' }, null],
    ]);
    expect(result.rows[0]).toMatchObject({
      id: 'rec-1',
      type: 'pts_created',
      targetType: 'pts',
      targetId: 'pts-1',
      happenedAt,
    });
  });
});
