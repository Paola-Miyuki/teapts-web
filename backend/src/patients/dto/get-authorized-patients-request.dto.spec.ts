// Este arquivo testa a validação e a normalização da consulta de pacientes
// autorizados antes que os parâmetros sejam enviados ao service.

import { BadRequestException } from '@nestjs/common';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from '../../common/pagination/pagination-query.dto';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import { GetAuthorizedPatientsRequestDto } from './get-authorized-patients-request.dto';

function normalize(query: Record<string, unknown>) {
  return createValidationPipe().transform(query, {
    type: 'query',
    metatype: GetAuthorizedPatientsRequestDto,
  }) as Promise<GetAuthorizedPatientsRequestDto>;
}

async function rejection(query: Record<string, unknown>) {
  const error: unknown = await normalize(query).catch((e: unknown) => e);

  expect(error).toBeInstanceOf(BadRequestException);
  return (error as BadRequestException).getResponse();
}

describe('GetAuthorizedPatientsRequestDto', () => {
  it('applies the shared default pagination', async () => {
    await expect(normalize({})).resolves.toEqual({
      page: DEFAULT_PAGE,
      limit: DEFAULT_PAGE_LIMIT,
    });
  });

  it('normalizes valid text values', async () => {
    await expect(normalize({ page: '3', limit: '25' })).resolves.toEqual({
      page: 3,
      limit: 25,
    });
  });

  it('trims the search term', async () => {
    await expect(normalize({ q: '  Maria  ' })).resolves.toMatchObject({
      q: 'Maria',
    });
  });

  it.each(['', '   '])('treats q %j as not informed', async (q) => {
    const result = await normalize({ q });

    expect(result.q).toBeUndefined();
  });

  it('rejects a repeated q parameter', async () => {
    await expect(rejection({ q: ['a', 'b'] })).resolves.toEqual({
      status: 'ERROR',
      message: 'Parâmetro inválido: q',
    });
  });

  it('accepts the status as a comma list or a repeated parameter', async () => {
    await expect(normalize({ status: 'running,none' })).resolves.toMatchObject({
      status: ['running', 'none'],
    });
    await expect(
      normalize({ status: ['concluded', 'cancelled', 'concluded'] }),
    ).resolves.toMatchObject({ status: ['concluded', 'cancelled'] });
  });

  it('accepts the filters and the ordering', async () => {
    await expect(
      normalize({
        responsibleProfessionalId: '7d0e8f2a-1c3b-4d5e-8f90-a1b2c3d4e5f6',
        registeredFrom: '2026-10-01',
        registeredTo: '2026-11-23',
        sort: 'registeredAt',
        order: 'desc',
      }),
    ).resolves.toMatchObject({
      responsibleProfessionalId: '7d0e8f2a-1c3b-4d5e-8f90-a1b2c3d4e5f6',
      registeredFrom: '2026-10-01',
      registeredTo: '2026-11-23',
      sort: 'registeredAt',
      order: 'desc',
    });
  });

  it('accepts the maximum limit', async () => {
    await expect(
      normalize({ limit: String(MAX_PAGE_LIMIT) }),
    ).resolves.toMatchObject({ limit: 50 });
  });

  it.each([
    ['page', { page: '0' }],
    ['page', { page: 'abc' }],
    ['page', { page: '1.5' }],
    ['limit', { limit: '0' }],
    ['limit', { limit: '51' }],
    ['status', { status: 'active' }],
    ['responsibleProfessionalId', { responsibleProfessionalId: 'abc' }],
    ['registeredFrom', { registeredFrom: '01/10/2026' }],
    ['registeredTo', { registeredTo: '2026-11' }],
    ['sort', { sort: 'email' }],
    ['order', { order: 'up' }],
  ])('rejects an invalid %s parameter', async (parameter, query) => {
    await expect(rejection(query)).resolves.toEqual({
      status: 'ERROR',
      message: `Parâmetro inválido: ${parameter}`,
    });
  });
});
