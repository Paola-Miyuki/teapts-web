import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import { GetActivitiesQueryDto } from './get-activities-query.dto';

function normalize(query: unknown) {
  return createValidationPipe().transform(query, {
    type: 'query',
    metatype: GetActivitiesQueryDto,
  }) as Promise<GetActivitiesQueryDto>;
}

async function errorBody(query: unknown) {
  const error: unknown = await normalize(query).catch(
    (reason: unknown) => reason,
  );

  expect(error).toBeInstanceOf(BadRequestException);
  return (error as BadRequestException).getResponse();
}

describe('GetActivitiesQueryDto', () => {
  it('applies default pagination', async () => {
    await expect(normalize({})).resolves.toMatchObject({ page: 1, limit: 20 });
  });

  it('accepts statuses as comma-separated or repeated parameters', async () => {
    await expect(
      normalize({ status: 'running, suspended' }),
    ).resolves.toMatchObject({ status: ['running', 'suspended'] });
    await expect(
      normalize({ status: ['running', 'running', 'concluded'] }),
    ).resolves.toMatchObject({ status: ['running', 'concluded'] });
  });

  it('accepts an executor and returns parameter errors for invalid filters', async () => {
    await expect(normalize({ executor: 'family' })).resolves.toMatchObject({
      executor: 'family',
    });
    await expect(errorBody({ status: 'running,unknown' })).resolves.toEqual({
      status: 'ERROR',
      message: 'Parâmetro inválido: status',
    });
    await expect(errorBody({ executor: 'others' })).resolves.toEqual({
      status: 'ERROR',
      message: 'Parâmetro inválido: executor',
    });
    await expect(errorBody({ page: '0' })).resolves.toEqual({
      status: 'ERROR',
      message: 'Parâmetro inválido: page',
    });
  });
});
