import { jest } from '@jest/globals';
import { Specialism } from '../enums/specialism.enum';
import type { GetProfessionalsRequestDto } from '../dto/get-professionals-request.dto';
import type {
  FindProfessionalsQuery,
  ProfessionalsPage,
  ProfessionalsRepository,
} from '../repositories/professionals.repository';
import { ProfessionalsService } from './professionals.service';

// O teste substitui o repository para validar só a regra do service:
// conversão para o contrato, paginação e erro seguro.
function createService() {
  const repository = {
    findPaginated:
      jest.fn<
        (filters: FindProfessionalsQuery) => Promise<ProfessionalsPage>
      >(),
  };
  const service = new ProfessionalsService(
    repository as unknown as ProfessionalsRepository,
  );

  return { repository, service };
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
