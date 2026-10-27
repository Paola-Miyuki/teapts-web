// Este arquivo testa a validação e a normalização da query da listagem de
// contas: filtros booleanos opcionais e paginação herdada.

import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import { GetAccountsRequestDto } from './get-accounts-request.dto';

function normalize(query: Record<string, unknown>) {
  return createValidationPipe().transform(query, {
    type: 'query',
    metatype: GetAccountsRequestDto,
  }) as Promise<GetAccountsRequestDto>;
}

describe('GetAccountsRequestDto', () => {
  it('lists every account when no filter is informed', async () => {
    await expect(normalize({})).resolves.toEqual({ page: 1, limit: 20 });
  });

  it.each([
    [{ isPatient: 'false' }, { isPatient: false }],
    [{ isPatient: 'true' }, { isPatient: true }],
    [{ isProfessional: 'true' }, { isProfessional: true }],
    [{ isProfessional: 'false' }, { isProfessional: false }],
    [{ isPatient: '' }, {}],
  ])('normalizes the filters %j', async (query, expected) => {
    await expect(normalize(query)).resolves.toEqual({
      page: 1,
      limit: 20,
      ...expected,
    });
  });

  it('inherits the shared pagination', async () => {
    await expect(
      normalize({ isPatient: 'false', page: '2', limit: '50' }),
    ).resolves.toEqual({ isPatient: false, page: 2, limit: 50 });
  });

  it.each([
    ['isPatient', { isPatient: 'yes' }],
    ['isPatient', { isPatient: '1' }],
    ['isProfessional', { isProfessional: 'TRUE ' }],
    ['limit', { limit: '51' }],
  ])('rejects an invalid %s parameter', async (parameter, query) => {
    const error: unknown = await normalize(query).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toEqual({
      status: 'ERROR',
      message: `Parâmetro inválido: ${parameter}`,
    });
  });
});
