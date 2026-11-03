import { jest } from '@jest/globals';
import {
  ConflictException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError, type Repository } from 'typeorm';
import type { Account } from '../../accounts/entities/account.entity';
import { AccountRole } from '../../accounts/enums/account-role.enum';
import type { Patient } from '../../patients/entities/patient.entity';
import type { Professional } from '../entities/professional.entity';
import { Specialism } from '../enums/specialism.enum';
import type { GetProfessionalsRequestDto } from '../dto/get-professionals-request.dto';
import type {
  FindProfessionalsQuery,
  ProfessionalsPage,
  ProfessionalsRepository,
} from '../repositories/professionals.repository';
import { ProfessionalsService } from './professionals.service';

// O teste substitui os repositories para validar só a regra do service:
// conversão para o contrato, paginação, regras do cadastro e erro seguro.
function createService() {
  const repository = {
    findPaginated:
      jest.fn<
        (filters: FindProfessionalsQuery) => Promise<ProfessionalsPage>
      >(),
    insert:
      jest.fn<
        (
          professional: Pick<Professional, 'accountId' | 'specialism'>,
        ) => Promise<string>
      >(),
  };
  const accountRepository = {
    findOne: jest.fn<(options: unknown) => Promise<Partial<Account> | null>>(),
  };
  const service = new ProfessionalsService(
    repository as unknown as ProfessionalsRepository,
    accountRepository as unknown as Repository<Account>,
  );

  return { repository, accountRepository, service };
}

const request: GetProfessionalsRequestDto = {
  page: 2,
  limit: 10,
  name: 'Maria',
  specialism: Specialism.Psychologist,
  ids: ['550e8400-e29b-41d4-a716-446655440000'],
};

describe('ProfessionalsService.findAll', () => {
  it('passes the filters to the repository and returns only the public summary', async () => {
    const { repository, service } = createService();
    repository.findPaginated.mockResolvedValue({
      rows: [
        {
          professional_id: '550e8400-e29b-41d4-a716-446655440000',
          professional_specialism: Specialism.Psychologist,
          account_name: 'Maria Silva',
          account_email: 'maria@example.com',
        },
      ],
      total: 11,
    });

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

    expect(repository.findPaginated).toHaveBeenCalledWith(request);
  });

  it('returns an empty page when there are no matches', async () => {
    const { repository, service } = createService();
    repository.findPaginated.mockResolvedValue({ rows: [], total: 0 });

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
    const { repository, service } = createService();
    repository.findPaginated.mockRejectedValue(
      new Error('database connection details'),
    );

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

describe('ProfessionalsService.create', () => {
  const accountId = '0b6f5a4e-2c1d-4e8f-9a7b-3c2d1e0f9a8b';
  const professionalId = '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
  const userAccount: Partial<Account> = {
    id: accountId,
    name: 'Kaio Felipe',
    email: 'kaio@exemplo.com',
    role: AccountRole.User,
    patientProfile: null,
    professionalProfiles: [],
  };

  function uniqueViolation() {
    return new QueryFailedError(
      'INSERT INTO "professional"',
      [],
      Object.assign(new Error('duplicate key value'), { code: '23505' }),
    );
  }

  async function createError(
    service: ProfessionalsService,
    specialism = Specialism.Psychologist,
  ) {
    return service
      .create({ accountId, specialism })
      .catch((error: unknown) => error);
  }

  it('persists the profile linked to the account and returns it', async () => {
    const { accountRepository, repository, service } = createService();
    accountRepository.findOne.mockResolvedValue(userAccount);
    repository.insert.mockResolvedValue(professionalId);

    await expect(
      service.create({ accountId, specialism: Specialism.Psychologist }),
    ).resolves.toEqual({
      id: professionalId,
      accountId,
      name: 'Kaio Felipe',
      email: 'kaio@exemplo.com',
      specialism: { id: Specialism.Psychologist, name: 'Psicologia' },
      deactivatedAt: null,
    });

    expect(accountRepository.findOne).toHaveBeenCalledWith({
      where: { id: accountId },
      relations: { patientProfile: true, professionalProfiles: true },
    });
    expect(repository.insert).toHaveBeenCalledWith({
      accountId,
      specialism: Specialism.Psychologist,
    });
  });

  it('creates a profile with another specialism for the same account', async () => {
    const { accountRepository, repository, service } = createService();
    accountRepository.findOne.mockResolvedValue({
      ...userAccount,
      professionalProfiles: [
        { accountId, specialism: Specialism.Doctor } as Professional,
      ],
    });
    repository.insert.mockResolvedValue(professionalId);

    await expect(
      service.create({ accountId, specialism: Specialism.Psychologist }),
    ).resolves.toMatchObject({
      id: professionalId,
      specialism: { id: Specialism.Psychologist, name: 'Psicologia' },
    });
  });

  it('returns 404 ACCOUNT_NOT_FOUND when the account does not exist', async () => {
    const { accountRepository, repository, service } = createService();
    accountRepository.findOne.mockResolvedValue(null);

    const error = await createError(service);

    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).getResponse()).toEqual({
      status: 'ACCOUNT_NOT_FOUND',
      message: 'Conta não encontrada.',
    });
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('returns 409 ADMIN_ACCOUNT_NOT_ALLOWED for an admin account', async () => {
    const { accountRepository, repository, service } = createService();
    accountRepository.findOne.mockResolvedValue({
      ...userAccount,
      role: AccountRole.Admin,
    });

    const error = await createError(service);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toEqual({
      status: 'ADMIN_ACCOUNT_NOT_ALLOWED',
      message: 'Conta de administrador não pode ter perfil profissional.',
    });
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('returns 409 ACCOUNT_HAS_PATIENT_PROFILE when the account is a patient', async () => {
    const { accountRepository, repository, service } = createService();
    accountRepository.findOne.mockResolvedValue({
      ...userAccount,
      patientProfile: { accountId } as Patient,
    });

    const error = await createError(service);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toEqual({
      status: 'ACCOUNT_HAS_PATIENT_PROFILE',
      message: 'A conta já possui um perfil de paciente.',
    });
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('returns 409 PROFESSIONAL_PROFILE_ALREADY_EXISTS for a repeated specialism', async () => {
    const { accountRepository, repository, service } = createService();
    accountRepository.findOne.mockResolvedValue({
      ...userAccount,
      professionalProfiles: [
        { accountId, specialism: Specialism.Psychologist } as Professional,
      ],
    });

    const error = await createError(service);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toEqual({
      status: 'PROFESSIONAL_PROFILE_ALREADY_EXISTS',
      message:
        'A conta já possui um perfil profissional com essa especialidade.',
    });
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('returns 409 when a simultaneous request created the profile first', async () => {
    const { accountRepository, repository, service } = createService();
    accountRepository.findOne.mockResolvedValue(userAccount);
    repository.insert.mockRejectedValue(uniqueViolation());

    await expect(
      service.create({ accountId, specialism: Specialism.Psychologist }),
    ).rejects.toMatchObject({
      response: {
        status: 'PROFESSIONAL_PROFILE_ALREADY_EXISTS',
        message:
          'A conta já possui um perfil profissional com essa especialidade.',
      },
    });
  });

  it('returns a safe internal error when the insert fails', async () => {
    const { accountRepository, repository, service } = createService();
    accountRepository.findOne.mockResolvedValue(userAccount);
    repository.insert.mockRejectedValue(
      new Error('database connection details'),
    );
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const error = await createError(service);

    expect(error).toBeInstanceOf(InternalServerErrorException);
    expect((error as InternalServerErrorException).getResponse()).toEqual({
      status: 'ERROR',
      message: 'Não foi possível cadastrar o perfil profissional.',
    });
  });
});
