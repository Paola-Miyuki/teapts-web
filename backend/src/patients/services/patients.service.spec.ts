// Este arquivo testa a regra do service, a conversão para o contrato público
// e o tratamento seguro dos erros do repository.

import { jest } from '@jest/globals';
import {
  ConflictException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError, type Repository } from 'typeorm';
import type { Account } from '../../accounts/entities/account.entity';
import type { CreatePatientRequestDto } from '../dto/create-patient-request.dto';
import type { GetAuthorizedPatientsRequestDto } from '../dto/get-authorized-patients-request.dto';
import type { Patient } from '../entities/patient.entity';
import type { NewPatient } from '../repositories/patients.repository';
import type {
  AuthorizedPatientsPage,
  PatientsRepository,
} from '../repositories/patients.repository';
import { PatientsService } from './patients.service';

function createService() {
  const repository = {
    insert: jest.fn<(patient: NewPatient) => Promise<void>>(),
    findAuthorizedPaginated:
      jest.fn<
        (
          accountId: string,
          filters: GetAuthorizedPatientsRequestDto,
        ) => Promise<AuthorizedPatientsPage>
      >(),
  };
  const accountRepository = {
    findOne: jest.fn<(options: unknown) => Promise<Partial<Account> | null>>(),
  };
  const service = new PatientsService(
    repository as unknown as PatientsRepository,
    accountRepository as unknown as Repository<Account>,
  );

  return { repository, accountRepository, service };
}

describe('PatientsService.findAuthorized', () => {
  it('passes the account and filters and returns only the public summary', async () => {
    const { repository, service } = createService();
    const request = { page: 2, limit: 10 };
    repository.findAuthorizedPaginated.mockResolvedValue({
      rows: [{ patient_id: 'patient-1', account_name: 'Maria Silva' }],
      total: 11,
    });

    await expect(
      service.findAuthorized('professional-account', request),
    ).resolves.toEqual({
      data: [{ id: 'patient-1', name: 'Maria Silva' }],
      pagination: { page: 2, limit: 10, total: 11, totalPages: 2 },
    });

    expect(repository.findAuthorizedPaginated).toHaveBeenCalledWith(
      'professional-account',
      request,
    );
  });

  it('returns an empty page with zero total pages', async () => {
    const { repository, service } = createService();
    repository.findAuthorizedPaginated.mockResolvedValue({
      rows: [],
      total: 0,
    });

    await expect(
      service.findAuthorized('account', { page: 1, limit: 10 }),
    ).resolves.toMatchObject({
      data: [],
      pagination: { total: 0, totalPages: 0 },
    });
  });

  it('returns a safe internal error when the repository fails', async () => {
    const { repository, service } = createService();
    repository.findAuthorizedPaginated.mockRejectedValue(
      new Error('database connection details'),
    );

    await expect(
      service.findAuthorized('account', { page: 1, limit: 10 }),
    ).rejects.toMatchObject({
      response: {
        status: 'ERROR',
        message: 'Não foi possível consultar os pacientes autorizados.',
      },
    });
  });
});

describe('PatientsService.create', () => {
  const accountId = '0b6f5a4e-2c1d-4e8f-9a7b-3c2d1e0f9a8b';
  const contact = {
    name: 'Maria Martins',
    description: 'Mãe',
    email: 'maria@exemplo.com',
    phone: '(11) 98765-4321',
  };

  function uniqueViolation() {
    return new QueryFailedError(
      'INSERT INTO "patient"',
      [],
      Object.assign(new Error('duplicate key value'), { code: '23505' }),
    );
  }

  it('persists the patient linked to the account and returns it', async () => {
    const { accountRepository, repository, service } = createService();
    accountRepository.findOne.mockResolvedValue({
      id: accountId,
      patientProfile: null,
    });
    repository.insert.mockResolvedValue(undefined);

    await expect(
      service.create({ accountId, supportContacts: [contact] }),
    ).resolves.toEqual({ accountId, supportContacts: [contact] });

    expect(accountRepository.findOne).toHaveBeenCalledWith({
      where: { id: accountId },
      relations: { patientProfile: true },
    });
    expect(repository.insert).toHaveBeenCalledWith({
      accountId,
      supportContacts: [contact],
    });
  });

  it('saves an empty list when there are no support contacts', async () => {
    const { accountRepository, repository, service } = createService();
    accountRepository.findOne.mockResolvedValue({ id: accountId });
    repository.insert.mockResolvedValue(undefined);

    await expect(service.create({ accountId })).resolves.toEqual({
      accountId,
      supportContacts: [],
    });
    expect(repository.insert).toHaveBeenCalledWith({
      accountId,
      supportContacts: [],
    });
  });

  it('normalizes the contacts before saving', async () => {
    const { accountRepository, repository, service } = createService();
    accountRepository.findOne.mockResolvedValue({ id: accountId });
    repository.insert.mockResolvedValue(undefined);

    await service.create({
      accountId,
      supportContacts: [
        {
          name: ' Maria ',
          description: ' ',
          email: undefined,
          phone: ' 1234 ',
        },
      ],
    } as CreatePatientRequestDto);

    expect(repository.insert).toHaveBeenCalledWith({
      accountId,
      supportContacts: [{ name: 'Maria', phone: '1234' }],
    });
  });

  it('returns 404 ACCOUNT_NOT_FOUND when the account does not exist', async () => {
    const { accountRepository, repository, service } = createService();
    accountRepository.findOne.mockResolvedValue(null);

    const error = await service.create({ accountId }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).getResponse()).toEqual({
      status: 'ACCOUNT_NOT_FOUND',
      message: 'Conta não encontrada.',
    });
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('returns 409 when the account already has a patient profile', async () => {
    const { accountRepository, repository, service } = createService();
    accountRepository.findOne.mockResolvedValue({
      id: accountId,
      patientProfile: { accountId } as Patient,
    });

    const error = await service.create({ accountId }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toEqual({
      status: 'PATIENT_PROFILE_ALREADY_EXISTS',
      message: 'A conta já possui perfil de paciente.',
    });
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('returns 409 when a simultaneous request created the profile first', async () => {
    const { accountRepository, repository, service } = createService();
    accountRepository.findOne.mockResolvedValue({ id: accountId });
    repository.insert.mockRejectedValue(uniqueViolation());

    await expect(service.create({ accountId })).rejects.toMatchObject({
      response: {
        status: 'PATIENT_PROFILE_ALREADY_EXISTS',
        message: 'A conta já possui perfil de paciente.',
      },
    });
  });

  it('returns a safe internal error when the insert fails', async () => {
    const { accountRepository, repository, service } = createService();
    accountRepository.findOne.mockResolvedValue({ id: accountId });
    repository.insert.mockRejectedValue(
      new Error('database connection details'),
    );
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const error = await service.create({ accountId }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(InternalServerErrorException);
    expect((error as InternalServerErrorException).getResponse()).toEqual({
      status: 'ERROR',
      message: 'Não foi possível cadastrar o perfil de paciente.',
    });
  });
});
