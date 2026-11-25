// Este arquivo testa a montagem da consulta de pacientes autorizados sem
// depender de uma conexão externa durante a execução unitária.

import { jest } from '@jest/globals';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { Account } from '../../accounts/entities/account.entity';
import { DocumentEntity } from '../../documents/entities/document.entity';
import { Professional } from '../../professionals/entities/professional.entity';
import { PtsEntity } from '../../pts/entities/pts.entity';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import { Patient } from '../entities/patient.entity';
import { Medication } from '../entities/medication.entity';
import { SupportContact } from '../entities/support-contact.entity';
import {
  ACTIVE_PTS_STATES,
  PatientsRepository,
  PROFESSIONAL_ACCESS_PTS_STATES,
} from './patients.repository';

describe('ACTIVE_PTS_STATES', () => {
  it('lists the planning and running PTS states', () => {
    expect(ACTIVE_PTS_STATES).toEqual([
      PtsStateEnum.PLANNING,
      PtsStateEnum.RUNNING,
    ]);
  });
});

describe('PROFESSIONAL_ACCESS_PTS_STATES', () => {
  it('adds the closed states to the active ones (RN016)', () => {
    expect(PROFESSIONAL_ACCESS_PTS_STATES).toEqual([
      PtsStateEnum.PLANNING,
      PtsStateEnum.RUNNING,
      PtsStateEnum.CONCLUDED,
      PtsStateEnum.CANCELLED,
    ]);
  });
});

// A lista usa subconsultas e a subconsulta `listed`; os testes montam o SQL com
// os metadados reais das entidades, sem conectar no banco, e conferem o SQL e
// os parâmetros que iriam para o Postgres.
describe('PatientsRepository list and detail', () => {
  let dataSource: DataSource;
  let repository: PatientsRepository;
  let captured: { sql: string; parameters: Record<string, unknown> }[];

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      entities: [
        Account,
        Patient,
        Medication,
        SupportContact,
        Professional,
        PtsEntity,
        DocumentEntity,
      ],
    });
    await (
      dataSource as unknown as { buildMetadatas(): Promise<void> }
    ).buildMetadatas();
  });

  beforeEach(() => {
    captured = [];
    repository = new PatientsRepository(dataSource.getRepository(Patient));
  });

  function answer(rawOne: unknown, rawMany: unknown[] = []) {
    const capture = function (this: SelectQueryBuilder<Patient>) {
      captured.push({ sql: this.getQuery(), parameters: this.getParameters() });
    };
    jest
      .spyOn(SelectQueryBuilder.prototype, 'getRawOne')
      .mockImplementation(function (this: SelectQueryBuilder<Patient>) {
        capture.call(this);
        return Promise.resolve(rawOne);
      });
    jest
      .spyOn(SelectQueryBuilder.prototype, 'getRawMany')
      .mockImplementation(function (this: SelectQueryBuilder<Patient>) {
        capture.call(this);
        return Promise.resolve(rawMany);
      });
  }

  const row = {
    patient_id: 'patient-1',
    account_name: 'Maria Silva',
    pts_status: PtsStateEnum.RUNNING,
  };

  it('lists every patient to the admin, with the PTS status and no read-only mark', async () => {
    answer({ total: '12' }, [row]);

    await expect(
      repository.findPatientsPaginated({ kind: 'all' }, { page: 2, limit: 10 }),
    ).resolves.toEqual({ rows: [row], total: 12 });

    const [count, page] = captured;
    expect(count.sql).toContain('SELECT COUNT(*) AS "total" FROM (SELECT');
    expect(page.sql).toContain('false AS "read_only"');
    expect(page.sql).toContain('COALESCE(');
    expect(page.sql).not.toContain('EXISTS');
    expect(page.sql).toContain(
      'ORDER BY listed.account_name ASC, listed.patient_id ASC',
    );
    expect(page.sql).toContain('LIMIT 10 OFFSET 10');
    expect(page.parameters).toMatchObject({
      activeStates: ACTIVE_PTS_STATES,
      rejectedState: PtsStateEnum.REJECTED,
    });
  });

  it('leaves the patients of deactivated accounts out of the list', async () => {
    answer({ total: '0' });

    await repository.findPatientsPaginated(
      { kind: 'all' },
      { page: 1, limit: 10 },
    );

    expect(captured[0].sql).toContain('"account"."status" = :activeStatus');
    expect(captured[0].parameters).toMatchObject({ activeStatus: 'active' });
  });

  it('limits the professional to the PTS of their account in the access states', async () => {
    answer({ total: '1' }, [row]);

    await repository.findPatientsPaginated(
      { kind: 'professional', accountId: 'account-1' },
      { page: 1, limit: 10 },
    );

    const page = captured[1];
    expect(page.sql).toContain('NOT EXISTS');
    expect(page.sql).toContain(
      'professional_participating_on_therapeutic_journey',
    );
    expect(page.sql).toContain('"read_only"');
    expect(page.parameters).toMatchObject({
      accountId: 'account-1',
      accessStates: PROFESSIONAL_ACCESS_PTS_STATES,
      statusFilter: PROFESSIONAL_ACCESS_PTS_STATES,
    });
  });

  it('searches name, social name, e-mail, CNS and CPF, and the digits when the term is a number', async () => {
    answer({ total: '0' });

    await repository.findPatientsPaginated(
      { kind: 'all' },
      { page: 1, limit: 10, q: '111.444' },
    );

    const page = captured[1];
    for (const column of ['name', 'social_name', 'email', 'cns', 'cpf']) {
      expect(page.sql).toContain(`."${column}" ILIKE :term`);
    }
    expect(page.sql).toContain(
      `regexp_replace("account"."cpf", '\\D', '', 'g') LIKE :digits`,
    );
    expect(page.parameters).toMatchObject({
      term: '%111.444%',
      digits: '%111444%',
    });
  });

  it('escapes % and _ in the search term and skips the digit search for text', async () => {
    answer({ total: '0' });

    await repository.findPatientsPaginated(
      { kind: 'all' },
      { page: 1, limit: 10, q: '50%_a' },
    );

    const page = captured[1];
    expect(page.parameters.term).toBe('%50\\%\\_a%');
    expect(page.sql).not.toContain('regexp_replace');
  });

  it('filters by PTS status, with none as the patient without PTS', async () => {
    answer({ total: '0' });

    await repository.findPatientsPaginated(
      { kind: 'all' },
      { page: 1, limit: 10, status: [PtsStateEnum.DRAFT, 'none'] },
    );

    const page = captured[1];
    expect(page.sql).toContain('listed.pts_status IN (');
    expect(page.sql).toContain('listed.pts_status IS NULL');
    expect(page.parameters.statusFilter).toEqual([PtsStateEnum.DRAFT]);
  });

  it('ignores the statuses the professional has no access to', async () => {
    answer({ total: '0' });

    await repository.findPatientsPaginated(
      { kind: 'professional', accountId: 'account-1' },
      {
        page: 1,
        limit: 10,
        status: [PtsStateEnum.DRAFT, PtsStateEnum.REJECTED, 'none'],
      },
    );

    const page = captured[1];
    expect(page.sql).toContain('1 = 0');
    expect(page.sql).not.toContain('listed.pts_status IS NULL');
    expect(page.parameters.statusFilter).toBeUndefined();
  });

  it('filters by responsible professional and registration dates, and sorts by date', async () => {
    answer({ total: '0' });

    await repository.findPatientsPaginated(
      { kind: 'all' },
      {
        page: 1,
        limit: 10,
        responsibleProfessionalId: 'professional-1',
        registeredFrom: '2026-10-01',
        registeredTo: '2026-11-23',
        sort: 'registeredAt',
        order: 'desc',
      },
    );

    const page = captured[1];
    expect(page.sql).toContain(
      '"responsible_professional_id" = :responsibleProfessionalId',
    );
    expect(page.sql).toContain(
      '"registered_at" >= CAST(:registeredFrom AS date)',
    );
    expect(page.sql).toContain('AS date) + 1');
    expect(page.sql).toContain('ORDER BY listed.registered_at DESC');
    expect(page.parameters).toMatchObject({
      responsibleProfessionalId: 'professional-1',
      registeredFrom: '2026-10-01',
      registeredTo: '2026-11-23',
    });
  });

  it('finds one patient inside the scope, or null outside it', async () => {
    answer(undefined);

    await expect(
      repository.findPatient(
        { kind: 'professional', accountId: 'account-1' },
        'patient-1',
      ),
    ).resolves.toBeNull();

    expect(captured[0].sql).toContain('"patient"."account_id" = :patientId');
    expect(captured[0].parameters).toMatchObject({
      patientId: 'patient-1',
      accountId: 'account-1',
    });
  });

  it('selects the registration data of the detail: account birth and sex, address, filiation and school', async () => {
    answer(undefined);

    await repository.findPatient({ kind: 'all' }, 'patient-1');

    // O TypeORM aspa os nomes; sem as aspas fica a forma escrita no código.
    const sql = captured[0].sql.replaceAll('"', '');

    expect(sql).toContain(
      `to_char(account.birth_date, 'YYYY-MM-DD') AS birth_date`,
    );

    for (const column of [
      'account.sex AS sex',
      'account.gender AS gender',
      'patient.guardian_phone AS guardian_phone',
      'patient.address_zip_code AS address_zip_code',
      'patient.address_state AS address_state',
      'patient.filiation_1 AS filiation_1',
      'patient.filiation_2 AS filiation_2',
      'patient.education_level AS education_level',
      'patient.school_name AS school_name',
      'patient.reference_unit AS reference_unit',
    ]) {
      expect(sql).toContain(column);
    }
  });

  describe('findCurrentPts', () => {
    function pts(status: PtsStateEnum, id: string) {
      return { id, status } as PtsEntity;
    }

    function answerMany(rows: PtsEntity[]) {
      jest
        .spyOn(SelectQueryBuilder.prototype, 'getMany')
        .mockImplementation(function (this: SelectQueryBuilder<PtsEntity>) {
          captured.push({
            sql: this.getQuery(),
            parameters: this.getParameters(),
          });
          return Promise.resolve(rows);
        });
    }

    it('leaves the rejected PTS out, newest first, and picks the active one', async () => {
      answerMany([
        pts(PtsStateEnum.CONCLUDED, 'newest'),
        pts(PtsStateEnum.RUNNING, 'active'),
      ]);

      await expect(
        repository.findCurrentPts('patient-1'),
      ).resolves.toMatchObject({ id: 'active' });
      expect(captured[0].sql).toContain('"pts"."status" <> :rejected');
      expect(captured[0].sql).toContain('ORDER BY "pts"."created_at" DESC');
      expect(captured[0].parameters).toMatchObject({
        patientId: 'patient-1',
        rejected: PtsStateEnum.REJECTED,
      });
    });

    it('falls back to the most recent PTS without an active one, or null without PTS', async () => {
      answerMany([
        pts(PtsStateEnum.CONCLUDED, 'newest'),
        pts(PtsStateEnum.CANCELLED, 'older'),
      ]);

      await expect(
        repository.findCurrentPts('patient-1'),
      ).resolves.toMatchObject({ id: 'newest' });

      jest.restoreAllMocks();
      answerMany([]);

      await expect(repository.findCurrentPts('patient-1')).resolves.toBeNull();
    });
  });

  it('checks for an active TCLE document of the patient', async () => {
    const exists = jest
      .spyOn(Repository.prototype, 'exists')
      .mockResolvedValue(true);

    await expect(repository.hasTcle('patient-1')).resolves.toBe(true);

    expect(exists).toHaveBeenCalledWith({
      where: {
        patientId: 'patient-1',
        category: 'tcle',
        deletedAt: expect.objectContaining({}),
      },
    });
  });
});

describe('PatientsRepository.findEligibleForProposalPaginated', () => {
  let dataSource: DataSource;
  let repository: PatientsRepository;
  let captured: { sql: string; parameters: Record<string, unknown> }[];

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      entities: [
        Account,
        Patient,
        Medication,
        SupportContact,
        Professional,
        PtsEntity,
      ],
    });
    await (
      dataSource as unknown as { buildMetadatas(): Promise<void> }
    ).buildMetadatas();
  });

  beforeEach(() => {
    captured = [];
    repository = new PatientsRepository(dataSource.getRepository(Patient));
    jest
      .spyOn(SelectQueryBuilder.prototype, 'getCount')
      .mockImplementation(function (this: SelectQueryBuilder<Patient>) {
        captured.push({
          sql: this.getQuery(),
          parameters: this.getParameters(),
        });
        return Promise.resolve(1);
      });
    jest
      .spyOn(SelectQueryBuilder.prototype, 'getRawMany')
      .mockImplementation(function (this: SelectQueryBuilder<Patient>) {
        captured.push({
          sql: this.getQuery(),
          parameters: this.getParameters(),
        });
        return Promise.resolve([eligibleRow]);
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const eligibleRow = {
    patient_id: 'patient-1',
    display_name: 'Maria Silva',
    email: 'maria@exemplo.com',
  };

  it('excludes patients with an active PTS or a non-deleted draft (RN011)', async () => {
    await expect(
      repository.findEligibleForProposalPaginated({ page: 2, limit: 10 }),
    ).resolves.toEqual({ rows: [eligibleRow], total: 1 });

    const [count, page] = captured;
    expect(count.sql).toContain('NOT EXISTS');
    expect(page.sql).toContain('pts.status = :draftState');
    expect(page.sql).toContain('pts.deleted_at IS NULL');
    expect(page.parameters).toMatchObject({
      activeStates: ACTIVE_PTS_STATES,
      draftState: PtsStateEnum.DRAFT,
    });
    expect(page.sql).toContain('LIMIT 10 OFFSET 10');
  });

  it('projects the display name and e-mail, never the CPF (DP011)', async () => {
    await repository.findEligibleForProposalPaginated({ page: 1, limit: 10 });

    const { sql } = captured[1];
    const select = sql.slice(0, sql.indexOf(' FROM '));
    expect(select).toContain('COALESCE(');
    expect(select).toContain('AS display_name');
    expect(select).toContain('AS email');
    expect(select).not.toContain('cpf');
    expect(sql).toContain('ORDER BY COALESCE(');
  });

  it('searches by name, social name, e-mail and CPF, with escaped wildcards', async () => {
    await repository.findEligibleForProposalPaginated({
      page: 1,
      limit: 10,
      q: '100%_a',
    });

    const { sql, parameters } = captured[1];
    expect(sql).toContain('ILIKE :term ESCAPE');
    expect(sql).toContain('"account"."social_name" ILIKE');
    expect(sql).toContain('"account"."cpf" ILIKE');
    expect(sql).not.toContain('cns');
    expect(parameters.term).toBe('%100\\%\\_a%');
  });

  it('also matches the CPF digits when the term is a masked CPF', async () => {
    await repository.findEligibleForProposalPaginated({
      page: 1,
      limit: 10,
      q: '123.456.789-09',
    });

    const { sql, parameters } = captured[1];
    expect(sql).toContain(
      `regexp_replace("account"."cpf", '\\D', '', 'g') LIKE`,
    );
    expect(sql).not.toContain('cns');
    expect(parameters.digits).toBe('%12345678909%');
  });
});

describe('PatientsRepository.insert', () => {
  function createInsertRepository() {
    const manager = {
      insert: jest.fn<(target: unknown, values: unknown) => Promise<unknown>>(),
    };
    manager.insert.mockResolvedValue({});
    const typeormRepository = {
      manager: {
        transaction: jest.fn(
          (run: (transactionManager: typeof manager) => Promise<void>) =>
            run(manager),
        ),
      },
    };
    const repository = new PatientsRepository(
      typeormRepository as unknown as Repository<Patient>,
    );

    return { manager, typeormRepository, repository };
  }

  it('saves the patient and each support contact in one transaction', async () => {
    const { manager, typeormRepository, repository } = createInsertRepository();

    await repository.insert({
      accountId: 'account-1',
      supportContacts: [
        { name: 'Maria Martins', email: 'maria@exemplo.com' },
        { name: 'João', description: 'Avô', phone: '41999999999' },
      ],
    });

    expect(typeormRepository.manager.transaction).toHaveBeenCalledTimes(1);
    expect(manager.insert).toHaveBeenNthCalledWith(1, Patient, {
      accountId: 'account-1',
    });
    expect(manager.insert).toHaveBeenNthCalledWith(2, SupportContact, [
      {
        patientId: 'account-1',
        name: 'Maria Martins',
        description: null,
        email: 'maria@exemplo.com',
        phone: null,
        isEmergency: false,
      },
      {
        patientId: 'account-1',
        name: 'João',
        description: 'Avô',
        email: null,
        phone: '41999999999',
        isEmergency: false,
      },
    ]);
  });

  it('skips the contacts insert when there are no support contacts', async () => {
    const { manager, repository } = createInsertRepository();

    await repository.insert({ accountId: 'account-1', supportContacts: [] });

    expect(manager.insert).toHaveBeenCalledTimes(1);
  });

  it('propagates database errors to the caller', async () => {
    const { manager, repository } = createInsertRepository();
    const failure = new Error('duplicate key value');
    manager.insert.mockRejectedValue(failure);

    await expect(
      repository.insert({ accountId: 'account-1', supportContacts: [] }),
    ).rejects.toBe(failure);
  });
});

describe('PatientsRepository support contact rows', () => {
  const values = {
    name: 'Ana',
    description: null,
    email: null,
    phone: '41999999999',
    isEmergency: true,
  };

  function createContactRepository() {
    const manager = {
      findOne: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      create: jest.fn((_target: unknown, entity: unknown) => entity),
      save: jest.fn(async (_target: unknown, entity: unknown) => entity),
      update: jest.fn<(...args: unknown[]) => Promise<{ affected?: number }>>(),
      delete: jest.fn<(...args: unknown[]) => Promise<{ affected?: number }>>(),
    };
    const repository = new PatientsRepository({
      manager,
    } as unknown as Repository<Patient>);

    return { manager, repository };
  }

  it('finds a contact only inside the patient', async () => {
    const { manager, repository } = createContactRepository();
    manager.findOne.mockResolvedValue(null);

    await expect(
      repository.findSupportContact('patient-1', 'contact-1'),
    ).resolves.toBeNull();
    expect(manager.findOne).toHaveBeenCalledWith(SupportContact, {
      where: { id: 'contact-1', patientId: 'patient-1' },
    });
  });

  it('inserts the contact linked to the patient', async () => {
    const { manager, repository } = createContactRepository();

    await repository.insertSupportContact('patient-1', values);

    expect(manager.save).toHaveBeenCalledWith(SupportContact, {
      ...values,
      patientId: 'patient-1',
    });
  });

  it('updates with updated_at and reloads, or returns null when nothing matches', async () => {
    const { manager, repository } = createContactRepository();
    manager.update.mockResolvedValueOnce({ affected: 0 });

    await expect(
      repository.updateSupportContact('patient-1', 'contact-1', values),
    ).resolves.toBeNull();

    manager.update.mockResolvedValueOnce({ affected: 1 });
    manager.findOne.mockResolvedValue({ id: 'contact-1' });

    await expect(
      repository.updateSupportContact('patient-1', 'contact-1', values),
    ).resolves.toEqual({ id: 'contact-1' });
    expect(manager.update).toHaveBeenLastCalledWith(
      SupportContact,
      { id: 'contact-1', patientId: 'patient-1' },
      { ...values, updatedAt: expect.any(Function) },
    );
  });

  it('deletes only inside the patient and tells if something was removed', async () => {
    const { manager, repository } = createContactRepository();
    manager.delete.mockResolvedValueOnce({ affected: 1 });
    manager.delete.mockResolvedValueOnce({ affected: 0 });

    await expect(
      repository.deleteSupportContact('patient-1', 'contact-1'),
    ).resolves.toBe(true);
    await expect(
      repository.deleteSupportContact('patient-1', 'contact-2'),
    ).resolves.toBe(false);
    expect(manager.delete).toHaveBeenCalledWith(SupportContact, {
      id: 'contact-1',
      patientId: 'patient-1',
    });
  });
});
