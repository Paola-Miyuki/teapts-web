// Este arquivo testa a paginação de query compartilhada: os padrões, os
// limites e o erro `{ status: 'ERROR' }` produzido pelo pipe global.

import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../validation/create-validation-pipe';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  PaginationQueryDto,
} from './pagination-query.dto';

function normalize(query: Record<string, unknown>) {
  return createValidationPipe().transform(query, {
    type: 'query',
    metatype: PaginationQueryDto,
  }) as Promise<PaginationQueryDto>;
}

describe('PaginationQueryDto', () => {
  it('uses page 1 and limit 20 by default, up to 50 items', () => {
    expect([DEFAULT_PAGE, DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT]).toEqual([
      1, 20, 50,
    ]);
  });

  it('applies the default pagination', async () => {
    await expect(normalize({})).resolves.toEqual({ page: 1, limit: 20 });
  });

  it('treats empty values as not informed', async () => {
    await expect(normalize({ page: '', limit: '' })).resolves.toEqual({
      page: 1,
      limit: 20,
    });
  });

  it('normalizes valid text values', async () => {
    await expect(normalize({ page: '3', limit: '25' })).resolves.toEqual({
      page: 3,
      limit: 25,
    });
  });

  it('accepts the maximum limit', async () => {
    await expect(normalize({ limit: '50' })).resolves.toMatchObject({
      limit: 50,
    });
  });

  it.each([
    ['page', { page: '0' }],
    ['page', { page: 'abc' }],
    ['page', { page: '1.5' }],
    ['limit', { limit: '0' }],
    ['limit', { limit: 'invalid' }],
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
