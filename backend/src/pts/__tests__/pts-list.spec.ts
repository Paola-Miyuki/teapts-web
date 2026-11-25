import { jest } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource, Repository } from 'typeorm';
import { AccountRole } from '../../accounts/enums/account-role.enum';
import type { AccountContext } from '../../accounts/services/accounts.service';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import { Patient } from '../../patients/entities/patient.entity';
import { Professional } from '../../professionals/entities/professional.entity';
import { PtsController } from '../controllers/pts.controller';
import { GetPtsListQueryDto } from '../dto/get-pts-list-query.dto';
import type { PtsListItemResponseDto } from '../dto/pts-list-response.dto';
import { PtsEntity } from '../entities/pts.entity';
import { PtsRepositoryImpl } from '../repositories/pts.repository.impl';
import { PtsService } from '../services/pts.service';
import { TimelineRecorderService } from '../../timeline/services/timeline-recorder.service';
import { InMemoryPtsRepository } from './in-memory-pts.repository';
import { expectApiError } from './test-utils';

const admin: AccountContext = {
  accountId: 'acc-admin',
  role: AccountRole.Admin,
  patientProfileId: null,
  professionalProfileIds: [],
};
const professional: AccountContext = {
  accountId: 'acc-1',
  role: AccountRole.User,
  patientProfileId: null,
  professionalProfileIds: ['prof-10'],
};
const patient: AccountContext = {
  accountId: 'acc-patient-25',
  role: AccountRole.User,
  patientProfileId: 'acc-patient-25',
  professionalProfileIds: [],
};
const professionalId = '123e4567-e89b-12d3-a456-426614174000';

async function validateQuery(query: Record<string, unknown>) {
  const dto = plainToInstance(GetPtsListQueryDto, query);
  const errors = await validate(dto);

  return { dto, errors };
}

const row: PtsListItemResponseDto = {
  id: 'pts-1',
  status: PtsStateEnum.RUNNING,
  version: 2,
  createdAt: '2026-10-26T14:30:00.000Z',
  beganAt: '2026-11-01T12:00:00.000Z',
  closedAt: null,
  patient: { id: 'acc-patient-25', name: 'Ana Clara Ribeiro' },
  responsible: {
    id: 'prof-10',
    name: 'Ana Souza',
    specialism: { id: 'psychologist', name: 'Psicologia' },
    registration: null,
  },
  team: [],
};

describe('GetPtsListQueryDto', () => {
  it('usa a página, o limite e a ordem padrão', async () => {
    const { dto, errors } = await validateQuery({});

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(dto.sort).toBeUndefined();
    expect(dto.order).toBeUndefined();
  });

  it('aceita status separados por vírgula e repetidos, sem duplicar', async () => {
    const comma = await validateQuery({ status: 'draft,planning,draft' });
    const repeated = await validateQuery({ status: ['running', 'concluded'] });

    expect(comma.errors).toHaveLength(0);
    expect(comma.dto.status).toEqual(['draft', 'planning']);
    expect(repeated.dto.status).toEqual(['running', 'concluded']);
  });

  it('trata filtros vazios como ausentes', async () => {
    const { dto, errors } = await validateQuery({
      q: '  ',
      status: '',
      responsibleId: '',
      createdFrom: '',
    });

    expect(errors).toHaveLength(0);
    expect(dto.q).toBeUndefined();
    expect(dto.status).toBeUndefined();
    expect(dto.responsibleId).toBeUndefined();
    expect(dto.createdFrom).toBeUndefined();
  });

  it.each([
    ['status', { status: 'ativo' }],
    ['responsibleId', { responsibleId: 'abc' }],
    ['memberId', { memberId: 'abc' }],
    ['createdFrom', { createdFrom: '10/11/2026' }],
    ['createdTo', { createdTo: '2026-13-40' }],
    ['sort', { sort: 'name' }],
    ['order', { order: 'up' }],
  ])('rejeita %s inválido', async (property, query) => {
    const { errors } = await validateQuery(query);

    expect(errors.some((error) => error.property === property)).toBe(true);
  });
});

describe('PtsService.findPtsList', () => {
  let repo: InMemoryPtsRepository;
  let service: PtsService;

  beforeEach(() => {
    repo = new InMemoryPtsRepository();
    repo.ptsListResult = { rows: [row], total: 41 };
    service = new PtsService(repo);
  });

  it('dá ao admin todos os PTS, sem restrição de equipe', async () => {
    const result = await service.findPtsList(
      plainToInstance(GetPtsListQueryDto, { page: '3', limit: '10' }),
      admin,
    );

    expect(repo.ptsListInputs[0]).toMatchObject({
      professionalProfileIds: null,
      sort: 'createdAt',
      order: 'desc',
      page: 3,
      limit: 10,
    });
    expect(result).toEqual({
      data: [row],
      pagination: { page: 3, limit: 10, total: 41, totalPages: 5 },
    });
  });

  it('restringe o profissional aos PTS em que ele é responsável ou membro', async () => {
    await service.findPtsList(
      plainToInstance(GetPtsListQueryDto, {}),
      professional,
    );

    expect(repo.ptsListInputs[0].professionalProfileIds).toEqual(['prof-10']);
  });

  it('repassa os filtros e a ordenação ao repositório', async () => {
    await service.findPtsList(
      plainToInstance(GetPtsListQueryDto, {
        q: ' ana ',
        status: 'draft,running',
        responsibleId: professionalId,
        memberId: professionalId,
        createdFrom: '2026-10-01',
        createdTo: '2026-11-23',
        sort: 'status',
        order: 'asc',
      }),
      admin,
    );

    expect(repo.ptsListInputs[0]).toMatchObject({
      q: 'ana',
      status: ['draft', 'running'],
      responsibleId: professionalId,
      memberId: professionalId,
      createdFrom: '2026-10-01',
      createdTo: '2026-11-23',
      sort: 'status',
      order: 'asc',
    });
  });

  it('nega o acesso ao paciente e à conta sem perfil', async () => {
    await expectApiError(
      () =>
        service.findPtsList(plainToInstance(GetPtsListQueryDto, {}), patient),
      403,
      'FORBIDDEN',
    );
    await expectApiError(
      () =>
        service.findPtsList(plainToInstance(GetPtsListQueryDto, {}), {
          ...professional,
          professionalProfileIds: [],
        }),
      403,
      'FORBIDDEN',
    );
    expect(repo.ptsListInputs).toHaveLength(0);
  });
});

describe('PtsController GET /pts', () => {
  it('devolve a lista paginada do service', async () => {
    const repo = new InMemoryPtsRepository();
    repo.ptsListResult = { rows: [row], total: 1 };
    const controller = new PtsController(new PtsService(repo));

    await expect(
      controller.findList(plainToInstance(GetPtsListQueryDto, {}), admin),
    ).resolves.toEqual({
      data: [row],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });
});

// Substitui o QueryBuilder para conferir as condições da consulta sem uma
// conexão com o banco.
function createRepository(entities: Partial<PtsEntity>[]) {
  const wheres: Array<{ sql: unknown; params?: unknown }> = [];
  const orders: string[] = [];
  const query = {
    innerJoin: jest.fn(),
    andWhere: jest.fn((sql: unknown, params?: unknown) => {
      wheres.push({ sql, params });
      return query;
    }),
    select: jest.fn(),
    addSelect: jest.fn(),
    orderBy: jest.fn((field: string, dir: string) => {
      orders.push(`${field} ${dir}`);
      return query;
    }),
    addOrderBy: jest.fn((field: string, dir: string) => {
      orders.push(`${field} ${dir}`);
      return query;
    }),
    where: jest.fn(),
    offset: jest.fn(),
    limit: jest.fn(),
    clone: jest.fn(),
    getCount: jest.fn(async () => 42),
    getRawMany: jest.fn(async (): Promise<unknown[]> => []),
  };

  for (const method of [
    query.innerJoin,
    query.select,
    query.addSelect,
    query.where,
    query.offset,
    query.limit,
    query.clone,
  ]) {
    method.mockReturnValue(query);
  }

  const ptsRepository = {
    createQueryBuilder: jest.fn(() => query),
    find: jest.fn(async () => entities),
  };
  const repository = new PtsRepositoryImpl(
    {} as DataSource,
    ptsRepository as unknown as Repository<PtsEntity>,
    {} as Repository<Professional>,
    {} as Repository<Patient>,
    {} as TimelineRecorderService,
  );

  return { repository, query, wheres, orders, ptsRepository };
}

const baseInput = {
  q: null,
  status: null,
  responsibleId: null,
  memberId: null,
  createdFrom: null,
  createdTo: null,
  sort: 'createdAt' as const,
  order: 'desc' as const,
  professionalProfileIds: null,
  page: 1,
  limit: 10,
};

describe('PtsRepositoryImpl.findPtsList', () => {
  it('não filtra nada para o admin sem filtros e devolve lista vazia sem consultar o resto', async () => {
    const { repository, wheres, ptsRepository } = createRepository([]);

    await expect(repository.findPtsList(baseInput)).resolves.toEqual({
      rows: [],
      total: 42,
    });
    expect(wheres).toHaveLength(0);
    expect(ptsRepository.find).not.toHaveBeenCalled();
  });

  it('aplica a restrição de equipe ao profissional', async () => {
    const { repository, query } = createRepository([]);

    await repository.findPtsList({
      ...baseInput,
      professionalProfileIds: ['prof-10'],
    });

    expect(query.andWhere).toHaveBeenCalledTimes(1);
  });

  it('aplica busca, status, responsável, membro e datas de criação', async () => {
    const { repository, wheres } = createRepository([]);

    await repository.findPtsList({
      ...baseInput,
      q: '100%',
      status: [PtsStateEnum.DRAFT, PtsStateEnum.RUNNING],
      responsibleId: 'prof-10',
      memberId: 'prof-11',
      createdFrom: '2026-10-01',
      createdTo: '2026-11-23',
    });

    const sql = wheres.map(({ sql: value }) => String(value));

    expect(sql).toHaveLength(6);
    expect(sql[1]).toBe('pts.status IN (:...statuses)');
    expect(sql[2]).toBe('pts.responsibleProfessionalId = :responsibleId');
    expect(sql[4]).toBe('pts.createdAt >= CAST(:createdFrom AS date)');
    expect(sql[5]).toBe('pts.createdAt < CAST(:createdTo AS date) + 1');
    expect(wheres[1].params).toEqual({
      statuses: [PtsStateEnum.DRAFT, PtsStateEnum.RUNNING],
    });
  });

  it('ordena por data de criação, ou pelo ciclo do status com a data como desempate', async () => {
    const byDate = createRepository([]);
    await byDate.repository.findPtsList({ ...baseInput, order: 'asc' });

    expect(byDate.orders).toEqual(['created_at ASC', 'pts.id ASC']);

    const byStatus = createRepository([]);
    await byStatus.repository.findPtsList({ ...baseInput, sort: 'status' });

    expect(byStatus.orders).toEqual([
      'status_rank DESC',
      'created_at DESC',
      'pts.id DESC',
    ]);
  });

  it('monta a linha com o nome social, a versão e o período, na ordem da consulta', async () => {
    const make = (
      id: string,
      overrides: Partial<PtsEntity> = {},
    ): Partial<PtsEntity> => ({
      id,
      patientId: 'acc-patient-25',
      status: PtsStateEnum.CONCLUDED,
      createdAt: new Date('2026-10-26T14:30:00.000Z'),
      beganAt: new Date('2026-11-01T12:00:00.000Z'),
      concludedAt: new Date('2026-12-30T12:00:00.000Z'),
      cancelledAt: null,
      patient: {
        accountId: 'acc-patient-25',
        account: { name: 'Ana Clara Ribeiro', socialName: ' Clara ' },
      } as Patient,
      responsible: {
        id: 'prof-10',
        specialism: 'psychologist',
        account: { name: 'Ana Souza' },
      } as unknown as Professional,
      team: [],
      ...overrides,
    });
    const { repository, query } = createRepository([
      make('pts-a'),
      make('pts-b', { concludedAt: null, status: PtsStateEnum.PLANNING }),
    ]);
    query.getRawMany
      .mockResolvedValueOnce([{ id: 'pts-b' }, { id: 'pts-a' }])
      .mockResolvedValueOnce([
        { id: 'pts-a', version: '1' },
        { id: 'pts-b', version: '2' },
      ]);

    const result = await repository.findPtsList(baseInput);

    expect(result.total).toBe(42);
    expect(result.rows.map((item) => item.id)).toEqual(['pts-b', 'pts-a']);
    expect(result.rows[0]).toMatchObject({
      version: 2,
      status: PtsStateEnum.PLANNING,
      closedAt: null,
      beganAt: '2026-11-01T12:00:00.000Z',
      patient: { id: 'acc-patient-25', name: 'Clara' },
      responsible: { id: 'prof-10', name: 'Ana Souza' },
    });
    expect(result.rows[1]).toMatchObject({
      version: 1,
      closedAt: '2026-12-30T12:00:00.000Z',
    });
  });
});
