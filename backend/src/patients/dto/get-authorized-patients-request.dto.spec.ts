// Este arquivo testa a validação e a normalização da paginação de pacientes
// autorizados antes que os parâmetros sejam enviados ao service.

import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import {
  DEFAULT_AUTHORIZED_PATIENTS_LIMIT,
  DEFAULT_AUTHORIZED_PATIENTS_PAGE,
  GetAuthorizedPatientsRequestDto,
  MAX_AUTHORIZED_PATIENTS_LIMIT,
} from './get-authorized-patients-request.dto';

function normalize(query: Record<string, unknown>) {
  return createValidationPipe().transform(query, {
    type: 'query',
    metatype: GetAuthorizedPatientsRequestDto,
  }) as Promise<GetAuthorizedPatientsRequestDto>;
}

describe('GetAuthorizedPatientsRequestDto', () => {
  it('applies the default pagination', async () => {
    await expect(normalize({})).resolves.toEqual({
      page: DEFAULT_AUTHORIZED_PATIENTS_PAGE,
      limit: DEFAULT_AUTHORIZED_PATIENTS_LIMIT,
    });
  });

  it('normalizes valid text values', async () => {
    await expect(normalize({ page: '3', limit: '25' })).resolves.toEqual({
      page: 3,
      limit: 25,
    });
  });

  it('accepts the maximum limit', async () => {
    await expect(
      normalize({ limit: String(MAX_AUTHORIZED_PATIENTS_LIMIT) }),
    ).resolves.toMatchObject({ limit: 100 });
  });

  it.each([
    ['page', { page: '0' }],
    ['page', { page: '-1' }],
    ['page', { page: 'abc' }],
    ['page', { page: '1.5' }],
    ['limit', { limit: '0' }],
    ['limit', { limit: 'invalid' }],
    ['limit', { limit: '101' }],
  ])('rejects an invalid %s parameter', async (parameter, query) => {
    const error: unknown = await normalize(query).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toEqual({
      status: 'ERROR',
      message: `Parâmetro inválido: ${parameter}`,
    });
  });
});
