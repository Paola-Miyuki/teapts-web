// Este arquivo testa a validação e a normalização da busca de pacientes
// elegíveis antes que os parâmetros sejam enviados ao service.

import { BadRequestException } from '@nestjs/common';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from '../../common/pagination/pagination-query.dto';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import { GetEligiblePatientsRequestDto } from './get-eligible-patients-request.dto';

function normalize(query: Record<string, unknown>) {
  return createValidationPipe().transform(query, {
    type: 'query',
    metatype: GetEligiblePatientsRequestDto,
  }) as Promise<GetEligiblePatientsRequestDto>;
}

async function rejection(query: Record<string, unknown>) {
  const error: unknown = await normalize(query).catch((e: unknown) => e);

  expect(error).toBeInstanceOf(BadRequestException);
  return (error as BadRequestException).getResponse();
}

describe('GetEligiblePatientsRequestDto', () => {
  it('applies the shared default pagination', async () => {
    await expect(normalize({ withActivePts: 'false' })).resolves.toEqual({
      withActivePts: 'false',
      page: DEFAULT_PAGE,
      limit: DEFAULT_PAGE_LIMIT,
    });
  });

  it('trims the search term', async () => {
    await expect(
      normalize({ withActivePts: 'false', q: '  Maria  ' }),
    ).resolves.toMatchObject({ q: 'Maria' });
  });

  it.each(['', '   '])('treats q %j as not informed', async (q) => {
    const result = await normalize({ withActivePts: 'false', q });

    expect(result.q).toBeUndefined();
  });

  it('accepts a search term of 2 characters', async () => {
    await expect(
      normalize({ withActivePts: 'false', q: ' ab ' }),
    ).resolves.toMatchObject({ q: 'ab' });
  });

  it.each([{}, { withActivePts: 'true' }, { withActivePts: '' }])(
    'requires withActivePts=false: %j',
    async (query) => {
      await expect(rejection(query)).resolves.toMatchObject({
        status: 'ERROR',
        message: 'Parâmetro inválido: withActivePts',
      });
    },
  );

  it('rejects a search term shorter than 2 characters', async () => {
    await expect(
      rejection({ withActivePts: 'false', q: ' a ' }),
    ).resolves.toMatchObject({
      status: 'ERROR',
      message: 'Parâmetro inválido: q',
    });
  });

  it.each([
    [{ page: '0' }, 'page'],
    [{ limit: '0' }, 'limit'],
    [{ limit: String(MAX_PAGE_LIMIT + 1) }, 'limit'],
  ])('rejects %j', async (query, param) => {
    await expect(
      rejection({ withActivePts: 'false', ...query }),
    ).resolves.toMatchObject({
      status: 'ERROR',
      message: `Parâmetro inválido: ${param}`,
    });
  });
});
