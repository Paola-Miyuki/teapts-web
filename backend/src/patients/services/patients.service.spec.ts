// Este arquivo testa a regra do service, a conversão para o contrato público
// e o tratamento seguro dos erros do repository.

import { jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError, type Repository } from 'typeorm';
import type { Account } from '../../accounts/entities/account.entity';
import type { AccountContext } from '../../accounts/services/accounts.service';
import { AccountRole } from '../../accounts/enums/account-role.enum';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';
import type { Professional } from '../../professionals/entities/professional.entity';
import { Specialism } from '../../professionals/enums/specialism.enum';
import type { CreatePatientRequestDto } from '../dto/create-patient-request.dto';
import type { GetAuthorizedPatientsRequestDto } from '../dto/get-authorized-patients-request.dto';
import type { Patient } from '../entities/patient.entity';
import type { NewPatient } from '../repositories/patients.repository';
import type { SupportContact } from '../entities/support-contact.entity';
import type {
  EligiblePatientsPage,
  EligiblePatientsQuery,
  PatientRow,
  PatientScope,
  PatientsPage,
  PatientsRepository,
  SupportContactValues,
} from '../repositories/patients.repository';
import { PatientsService } from './patients.service';

function createService() {
  const repository = {
    insert: jest.fn<(patient: NewPatient) => Promise<void>>(),
    findPatientsPaginated:
      jest.fn<
        (
          scope: PatientScope,
          filters: GetAuthorizedPatientsRequestDto,
        ) => Promise<PatientsPage>
      >(),
    findPatient:
      jest.fn<
        (scope: PatientScope, patientId: string) => Promise<PatientRow | null>
      >(),
    patientExists: jest.fn<(patientId: string) => Promise<boolean>>(),
    findSupportContacts:
      jest.fn<(patientId: string) => Promise<SupportContact[]>>(),
    insertSupportContact:
      jest.fn<
        (
          patientId: string,
          values: SupportContactValues,
        ) => Promise<SupportContact>
      >(),
    findSupportContact:
      jest.fn<
        (patientId: string, contactId: string) => Promise<SupportContact | null>
      >(),
    updateSupportContact:
      jest.fn<
        (
          patientId: string,
          contactId: string,
          values: SupportContactValues,
        ) => Promise<SupportContact | null>
      >(),
    deleteSupportContact:
      jest.fn<(patientId: string, contactId: string) => Promise<boolean>>(),
    findEligibleForProposalPaginated:
      jest.fn<
        (filters: EligiblePatientsQuery) => Promise<EligiblePatientsPage>
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

const professionalAccount: AccountContext = {
  accountId: 'account-1',
  role: AccountRole.User,
  patientProfileId: null,
  professionalProfileIds: ['professional-1'],
};

const adminAccount: AccountContext = {
  accountId: 'admin-1',
  role: AccountRole.Admin,
  patientProfileId: null,
  professionalProfileIds: [],
};

const row: PatientRow = {
  patient_id: 'patient-1',
  account_name: 'Maria Silva',
  social_name: null,
  email: 'maria@exemplo.com',
  phone: '41991002030',
  cpf: '11144477735',
  cns: '700000000000005',
  guardian_name: 'Ana Silva',
  registered_at: new Date('2026-10-01T12:00:00.000Z'),
  pts_status: PtsStateEnum.CONCLUDED,
  active_pts_id: null,
  read_only: true,
};

const listed = {
  id: 'patient-1',
  name: 'Maria Silva',
  socialName: null,
  email: 'maria@exemplo.com',
  cns: '700000000000005',
  guardianName: 'Ana Silva',
  registeredAt: '2026-10-01T12:00:00.000Z',
  ptsStatus: PtsStateEnum.CONCLUDED,
  activePtsId: null,
  readOnly: true,
};

const patientAccount: AccountContext = {
  accountId: 'patient-9',
  role: AccountRole.User,
  patientProfileId: 'patient-9',
  professionalProfileIds: [],
};

describe('PatientsService.findAuthorized', () => {
  it('limits the professional to the own scope and returns the list fields', async () => {
    const { repository, service } = createService();
    const request = { page: 2, limit: 10, q: 'mari' };
    repository.findPatientsPaginated.mockResolvedValue({
      rows: [row],
      total: 11,
    });

    await expect(
      service.findAuthorized(professionalAccount, request),
    ).resolves.toEqual({
      data: [listed],
      pagination: { page: 2, limit: 10, total: 11, totalPages: 2 },
    });

    expect(repository.findPatientsPaginated).toHaveBeenCalledWith(
      { kind: 'professional', accountId: 'account-1' },
      request,
    );
  });

  it('returns every patient to the admin', async () => {
    const { repository, service } = createService();
    const request = { page: 1, limit: 10 };
    repository.findPatientsPaginated.mockResolvedValue({
      rows: [
        { ...row, read_only: false, registered_at: '2026-10-01 12:00:00' },
      ],
      total: 1,
    });

    const result = await service.findAuthorized(adminAccount, request);

    expect(result.data[0]).toMatchObject({ readOnly: false });
    expect(repository.findPatientsPaginated).toHaveBeenCalledWith(
      { kind: 'all' },
      request,
    );
  });

  it('answers 403 to an account without a professional profile', async () => {
    const { repository, service } = createService();

    await expect(
      service.findAuthorized(patientAccount, { page: 1, limit: 10 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.findPatientsPaginated).not.toHaveBeenCalled();
  });

  it('returns an empty page with zero total pages', async () => {
    const { repository, service } = createService();
    repository.findPatientsPaginated.mockResolvedValue({ rows: [], total: 0 });

    await expect(
      service.findAuthorized(professionalAccount, { page: 1, limit: 10 }),
    ).resolves.toMatchObject({
      data: [],
      pagination: { total: 0, totalPages: 0 },
    });
  });

  describe('PatientsService.findEligibleForProposal', () => {
    it('allows the admin without a professional profile', async () => {
      const { repository, service } = createService();
      repository.findEligibleForProposalPaginated.mockResolvedValue({
        rows: [
          {
            patient_id: 'patient-1',
            display_name: 'Maria Silva',
            email: 'maria@exemplo.com',
          },
        ],
        total: 1,
      });

      await expect(
        service.findEligibleForProposal(adminAccount, {
          page: 1,
          limit: 10,
          withActivePts: 'false',
        }),
      ).resolves.toMatchObject({ data: [{ id: 'patient-1' }] });
    });

    it('blocks accounts without a professional profile', async () => {
      const { repository, service } = createService();

      await expect(
        service.findEligibleForProposal(
          { ...professionalAccount, professionalProfileIds: [] },
          { page: 1, limit: 10, withActivePts: 'false' },
        ),
      ).rejects.toMatchObject({
        status: 403,
        response: { status: 'FORBIDDEN' },
      });
      expect(
        repository.findEligibleForProposalPaginated,
      ).not.toHaveBeenCalled();
    });

    it('returns patients that can receive a new proposal', async () => {
      const { repository, service } = createService();
      repository.findEligibleForProposalPaginated.mockResolvedValue({
        rows: [
          {
            patient_id: 'patient-1',
            display_name: 'Maria Silva',
            email: 'maria@exemplo.com',
          },
        ],
        total: 1,
      });

      await expect(
        service.findEligibleForProposal(professionalAccount, {
          page: 1,
          limit: 10,
          q: 'maria',
          withActivePts: 'false',
        }),
      ).resolves.toEqual({
        data: [
          { id: 'patient-1', name: 'Maria Silva', email: 'maria@exemplo.com' },
        ],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });
      expect(repository.findEligibleForProposalPaginated).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        q: 'maria',
      });
    });

    it('returns a safe internal error when the eligible-patients query fails', async () => {
      const { repository, service } = createService();
      repository.findEligibleForProposalPaginated.mockRejectedValue(
        new Error('database connection details'),
      );

      await expect(
        service.findEligibleForProposal(professionalAccount, {
          page: 1,
          limit: 10,
          q: 'maria',
          withActivePts: 'false',
        }),
      ).rejects.toMatchObject({
        response: {
          status: 'ERROR',
          message: 'Não foi possível consultar os pacientes elegíveis.',
        },
      });
    });
  });

  it('returns a safe internal error when the repository fails', async () => {
    const { repository, service } = createService();
    repository.findPatientsPaginated.mockRejectedValue(
      new Error('database connection details'),
    );

    await expect(
      service.findAuthorized(professionalAccount, { page: 1, limit: 10 }),
    ).rejects.toMatchObject({
      response: {
        status: 'ERROR',
        message: 'Não foi possível consultar os pacientes autorizados.',
      },
    });
  });
});

describe('PatientsService.findOne', () => {
  it('returns the patient with CPF and support contacts to the team', async () => {
    const { repository, service } = createService();
    repository.patientExists.mockResolvedValue(true);
    repository.findPatient.mockResolvedValue(row);
    repository.findSupportContacts.mockResolvedValue([
      {
        id: 'contact-1',
        name: 'Ana Silva',
        description: 'Mãe',
        email: null,
        phone: '41999999999',
        isEmergency: true,
      } as SupportContact,
    ]);

    await expect(
      service.findOne(professionalAccount, 'patient-1'),
    ).resolves.toEqual({
      ...listed,
      phone: '41991002030',
      cpf: '11144477735',
      supportContacts: [
        {
          id: 'contact-1',
          name: 'Ana Silva',
          description: 'Mãe',
          email: null,
          phone: '41999999999',
          isEmergency: true,
        },
      ],
    });
    expect(repository.findPatient).toHaveBeenCalledWith(
      { kind: 'professional', accountId: 'account-1' },
      'patient-1',
    );
  });

  it('answers 404 PATIENT_NOT_FOUND for a missing patient', async () => {
    const { repository, service } = createService();
    repository.patientExists.mockResolvedValue(false);

    const error: unknown = await service
      .findOne(adminAccount, 'patient-1')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).getResponse()).toEqual({
      status: 'PATIENT_NOT_FOUND',
      message: 'Paciente não encontrado.',
    });
  });

  it('answers 403 to a professional without access (RN016)', async () => {
    const { repository, service } = createService();
    repository.patientExists.mockResolvedValue(true);
    repository.findPatient.mockResolvedValue(null);

    await expect(
      service.findOne(professionalAccount, 'patient-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('answers 403 to a patient account', async () => {
    const { repository, service } = createService();

    await expect(
      service.findOne(patientAccount, 'patient-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.patientExists).not.toHaveBeenCalled();
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
      role: AccountRole.User,
      patientProfile: null,
      professionalProfiles: [],
    });
    repository.insert.mockResolvedValue(undefined);

    await expect(
      service.create({ accountId, supportContacts: [contact] }),
    ).resolves.toEqual({
      accountId,
      supportContacts: [{ ...contact, isEmergency: false }],
    });

    expect(accountRepository.findOne).toHaveBeenCalledWith({
      where: { id: accountId },
      relations: { patientProfile: true, professionalProfiles: true },
    });
    expect(repository.insert).toHaveBeenCalledWith({
      accountId,
      supportContacts: [{ ...contact, isEmergency: false }],
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
      supportContacts: [{ name: 'Maria', phone: '1234', isEmergency: false }],
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

  it('returns 409 ADMIN_ACCOUNT_NOT_ALLOWED for an admin account', async () => {
    const { accountRepository, repository, service } = createService();
    accountRepository.findOne.mockResolvedValue({
      id: accountId,
      role: AccountRole.Admin,
      patientProfile: null,
      professionalProfiles: [],
    });

    const error = await service.create({ accountId }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toEqual({
      status: 'ADMIN_ACCOUNT_NOT_ALLOWED',
      message: 'Conta de administrador não pode ter perfil de paciente.',
    });
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('returns 409 ACCOUNT_HAS_PROFESSIONAL_PROFILE for a professional account', async () => {
    const { accountRepository, repository, service } = createService();
    accountRepository.findOne.mockResolvedValue({
      id: accountId,
      role: AccountRole.User,
      patientProfile: null,
      professionalProfiles: [
        { accountId, specialism: Specialism.Doctor } as Professional,
      ],
    });

    const error = await service.create({ accountId }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toEqual({
      status: 'ACCOUNT_HAS_PROFESSIONAL_PROFILE',
      message: 'A conta já possui um perfil profissional.',
    });
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('checks the professional profile before the patient profile', async () => {
    const { accountRepository, service } = createService();
    accountRepository.findOne.mockResolvedValue({
      id: accountId,
      role: AccountRole.User,
      patientProfile: { accountId } as Patient,
      professionalProfiles: [
        { accountId, specialism: Specialism.Doctor } as Professional,
      ],
    });

    await expect(service.create({ accountId })).rejects.toMatchObject({
      response: { status: 'ACCOUNT_HAS_PROFESSIONAL_PROFILE' },
    });
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

describe('PatientsService support contacts', () => {
  const stored = {
    id: 'contact-1',
    patientId: 'patient-1',
    name: 'Ana Silva',
    description: 'Mãe',
    email: null,
    phone: '41999999999',
    isEmergency: false,
  } as SupportContact;
  const response = {
    id: 'contact-1',
    name: 'Ana Silva',
    description: 'Mãe',
    email: null,
    phone: '41999999999',
    isEmergency: false,
  };
  const activeMember: PatientRow = { ...row, read_only: false };

  function ready() {
    const made = createService();
    made.repository.patientExists.mockResolvedValue(true);
    made.repository.findPatient.mockResolvedValue(activeMember);
    return made;
  }

  async function errorOf(promise: Promise<unknown>) {
    return promise.catch((e: unknown) => e);
  }

  it('lists the contacts to the own patient without scope lookup', async () => {
    const { repository, service } = ready();
    repository.findSupportContacts.mockResolvedValue([stored]);

    await expect(
      service.findSupportContacts(
        { ...patientAccount, patientProfileId: 'patient-1' },
        'patient-1',
      ),
    ).resolves.toEqual({ data: [response] });
    expect(repository.findPatient).not.toHaveBeenCalled();
  });

  it('lists the contacts to a professional of a closed PTS (read only)', async () => {
    const { repository, service } = ready();
    repository.findPatient.mockResolvedValue(row);
    repository.findSupportContacts.mockResolvedValue([stored]);

    await expect(
      service.findSupportContacts(professionalAccount, 'patient-1'),
    ).resolves.toEqual({ data: [response] });
  });

  it('answers 403 when another patient lists the contacts', async () => {
    const { service } = ready();

    expect(
      await errorOf(service.findSupportContacts(patientAccount, 'patient-1')),
    ).toBeInstanceOf(ForbiddenException);
  });

  it('answers 404 PATIENT_NOT_FOUND for a missing patient', async () => {
    const { repository, service } = ready();
    repository.patientExists.mockResolvedValue(false);

    expect(
      await errorOf(service.findSupportContacts(adminAccount, 'patient-1')),
    ).toBeInstanceOf(NotFoundException);
  });

  it('creates a contact for the admin, normalizing the text', async () => {
    const { repository, service } = ready();
    repository.insertSupportContact.mockResolvedValue(stored);

    await expect(
      service.createSupportContact(adminAccount, 'patient-1', {
        name: ' Ana Silva ',
        description: 'Mãe',
        phone: '41999999999',
      }),
    ).resolves.toEqual(response);
    expect(repository.insertSupportContact).toHaveBeenCalledWith('patient-1', {
      name: 'Ana Silva',
      description: 'Mãe',
      email: null,
      phone: '41999999999',
      isEmergency: false,
    });
    expect(repository.findPatient).not.toHaveBeenCalled();
  });

  it('creates a contact for a member of an active PTS', async () => {
    const { repository, service } = ready();
    repository.insertSupportContact.mockResolvedValue(stored);

    await service.createSupportContact(professionalAccount, 'patient-1', {
      name: 'Ana',
      email: 'ana@exemplo.com',
    });

    expect(repository.insertSupportContact).toHaveBeenCalled();
  });

  it.each([
    ['a professional of a closed PTS', professionalAccount, true],
    ['the own patient', patientAccount, false],
  ])('answers 403 to create for %s', async (_case, account, readOnly) => {
    const { repository, service } = ready();
    repository.findPatient.mockResolvedValue({ ...row, read_only: readOnly });

    expect(
      await errorOf(
        service.createSupportContact(
          { ...account, patientProfileId: 'patient-1' },
          'patient-1',
          { name: 'Ana', phone: '41999999999' },
        ),
      ),
    ).toBeInstanceOf(ForbiddenException);
    expect(repository.insertSupportContact).not.toHaveBeenCalled();
  });

  it('answers 400 for a contact without e-mail and phone', async () => {
    const { repository, service } = ready();

    const error = await errorOf(
      service.createSupportContact(adminAccount, 'patient-1', { name: 'Ana' }),
    );

    expect((error as BadRequestException).getResponse()).toEqual({
      status: 'VALIDATION_ERROR',
      message: 'Informe o e-mail ou o telefone do contato.',
    });
    expect(repository.insertSupportContact).not.toHaveBeenCalled();
  });

  it('answers 400 for an emergency contact without phone', async () => {
    const { service } = ready();

    const error = await errorOf(
      service.createSupportContact(adminAccount, 'patient-1', {
        name: 'Ana',
        email: 'ana@exemplo.com',
        isEmergency: true,
      }),
    );

    expect((error as BadRequestException).getResponse()).toEqual({
      status: 'VALIDATION_ERROR',
      message: 'Informe o telefone do contato de emergência.',
    });
  });

  it('keeps the fields that the patch does not send and clears with null', async () => {
    const { repository, service } = ready();
    repository.findSupportContact.mockResolvedValue({
      ...stored,
      email: 'ana@exemplo.com',
    });
    repository.updateSupportContact.mockResolvedValue(stored);

    await service.updateSupportContact(adminAccount, 'patient-1', 'contact-1', {
      email: null,
      isEmergency: true,
    });

    expect(repository.updateSupportContact).toHaveBeenCalledWith(
      'patient-1',
      'contact-1',
      {
        name: 'Ana Silva',
        description: 'Mãe',
        email: null,
        phone: '41999999999',
        isEmergency: true,
      },
    );
  });

  it('checks the rule on the resulting contact of a patch', async () => {
    const { repository, service } = ready();
    repository.findSupportContact.mockResolvedValue(stored);

    const error = await errorOf(
      service.updateSupportContact(adminAccount, 'patient-1', 'contact-1', {
        phone: null,
      }),
    );

    expect((error as BadRequestException).getResponse()).toEqual({
      status: 'VALIDATION_ERROR',
      message: 'Informe o e-mail ou o telefone do contato.',
    });
    expect(repository.updateSupportContact).not.toHaveBeenCalled();
  });

  it('answers 404 SUPPORT_CONTACT_NOT_FOUND on patch and delete', async () => {
    const { repository, service } = ready();
    repository.findSupportContact.mockResolvedValue(null);
    repository.deleteSupportContact.mockResolvedValue(false);

    const patched = await errorOf(
      service.updateSupportContact(adminAccount, 'patient-1', 'contact-1', {
        name: 'Ana',
      }),
    );
    const deleted = await errorOf(
      service.deleteSupportContact(adminAccount, 'patient-1', 'contact-1'),
    );

    for (const error of [patched, deleted]) {
      expect((error as NotFoundException).getResponse()).toEqual({
        status: 'SUPPORT_CONTACT_NOT_FOUND',
        message: 'Contato de suporte não encontrado.',
      });
    }
  });

  it('deletes the contact', async () => {
    const { repository, service } = ready();
    repository.deleteSupportContact.mockResolvedValue(true);

    await expect(
      service.deleteSupportContact(adminAccount, 'patient-1', 'contact-1'),
    ).resolves.toBeUndefined();
    expect(repository.deleteSupportContact).toHaveBeenCalledWith(
      'patient-1',
      'contact-1',
    );
  });

  it('returns a safe internal error when the repository fails', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { repository, service } = ready();
    repository.deleteSupportContact.mockRejectedValue(new Error('db down'));

    const error = await errorOf(
      service.deleteSupportContact(adminAccount, 'patient-1', 'contact-1'),
    );

    expect(error).toBeInstanceOf(InternalServerErrorException);
    expect((error as InternalServerErrorException).getResponse()).toEqual({
      status: 'ERROR',
      message: 'Não foi possível remover o contato de suporte.',
    });
  });
});
