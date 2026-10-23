// Este arquivo testa a regra do service, a conversão para o contrato público
// e o tratamento seguro dos erros do repository.

import { jest } from '@jest/globals';
import type { GetAuthorizedPatientsRequestDto } from '../dto/get-authorized-patients-request.dto';
import type {
  AuthorizedPatientsPage,
  PatientsRepository,
} from '../repositories/patients.repository';
import { PatientsService } from './patients.service';

function createService() {
  const repository = {
    findAuthorizedPaginated:
      jest.fn<
        (
          accountId: string,
          filters: GetAuthorizedPatientsRequestDto,
        ) => Promise<AuthorizedPatientsPage>
      >(),
  };
  const service = new PatientsService(
    repository as unknown as PatientsRepository,
  );

  return { repository, service };
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
