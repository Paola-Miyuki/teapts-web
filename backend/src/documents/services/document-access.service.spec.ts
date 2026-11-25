import { jest } from '@jest/globals';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AccountRole } from '../../accounts/enums/account-role.enum';
import type { AccountContext } from '../../accounts/services/accounts.service';
import type {
  PatientDetailRow,
  PatientsRepository,
} from '../../patients/repositories/patients.repository';
import { DocumentAccessService } from './document-access.service';

const patientId = 'patient-1';

function createService() {
  const repository = {
    patientExists: jest.fn<(id: string) => Promise<boolean>>(),
    findPatient:
      jest.fn<
        (scope: unknown, id: string) => Promise<PatientDetailRow | null>
      >(),
  };
  repository.patientExists.mockResolvedValue(true);

  return {
    repository,
    service: new DocumentAccessService(
      repository as unknown as PatientsRepository,
    ),
  };
}

const account = (overrides: Partial<AccountContext>): AccountContext => ({
  accountId: 'account-1',
  role: AccountRole.User,
  patientProfileId: null,
  professionalProfileIds: [],
  ...overrides,
});

const linked = (readOnly: boolean) =>
  ({ read_only: readOnly }) as unknown as PatientDetailRow;

describe('DocumentAccessService.assertAccess', () => {
  it('returns 404 PATIENT_NOT_FOUND when the patient does not exist', async () => {
    const { repository, service } = createService();
    repository.patientExists.mockResolvedValue(false);

    const error: unknown = await service
      .assertAccess(account({ role: AccountRole.Admin }), patientId, 'write')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NotFoundException);
    expect((error as NotFoundException).getResponse()).toMatchObject({
      status: 'PATIENT_NOT_FOUND',
    });
  });

  it('lets the admin write for any patient', async () => {
    const { service } = createService();

    await expect(
      service.assertAccess(
        account({ role: AccountRole.Admin }),
        patientId,
        'write',
      ),
    ).resolves.toBeUndefined();
  });

  it('lets the patient write only to their own id', async () => {
    const { service } = createService();

    await expect(
      service.assertAccess(
        account({ patientProfileId: patientId }),
        patientId,
        'write',
      ),
    ).resolves.toBeUndefined();
    await expect(
      service.assertAccess(
        account({ patientProfileId: 'patient-2' }),
        patientId,
        'write',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets a professional with an active PTS write', async () => {
    const { repository, service } = createService();
    repository.findPatient.mockResolvedValue(linked(false));

    await expect(
      service.assertAccess(
        account({ professionalProfileIds: ['pro-1'] }),
        patientId,
        'write',
      ),
    ).resolves.toBeUndefined();
    expect(repository.findPatient).toHaveBeenCalledWith(
      { kind: 'professional', accountId: 'account-1' },
      patientId,
    );
  });

  it('blocks writing for a professional whose PTS is concluded or cancelled, but not reading', async () => {
    const { repository, service } = createService();
    repository.findPatient.mockResolvedValue(linked(true));
    const professional = account({ professionalProfileIds: ['pro-1'] });

    await expect(
      service.assertAccess(professional, patientId, 'write'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.assertAccess(professional, patientId, 'read'),
    ).resolves.toBeUndefined();
  });

  it('blocks a professional without a link to the patient', async () => {
    const { repository, service } = createService();
    repository.findPatient.mockResolvedValue(null);

    await expect(
      service.assertAccess(
        account({ professionalProfileIds: ['pro-1'] }),
        patientId,
        'read',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks an account with no profile', async () => {
    const { service } = createService();

    await expect(
      service.assertAccess(account({}), patientId, 'read'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
