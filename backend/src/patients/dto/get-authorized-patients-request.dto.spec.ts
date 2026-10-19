import { BadRequestException } from '@nestjs/common';
import {
  DEFAULT_AUTHORIZED_PATIENTS_LIMIT,
  DEFAULT_AUTHORIZED_PATIENTS_PAGE,
  MAX_AUTHORIZED_PATIENTS_LIMIT,
  normalizeGetAuthorizedPatientsQuery,
} from './get-authorized-patients-request.dto';

describe('normalizeGetAuthorizedPatientsQuery', () => {
  it('applies defaults', () => {
    expect(normalizeGetAuthorizedPatientsQuery({})).toEqual({
      page: DEFAULT_AUTHORIZED_PATIENTS_PAGE,
      limit: DEFAULT_AUTHORIZED_PATIENTS_LIMIT,
    });
  });

  it('converts valid text values and accepts the maximum limit', () => {
    expect(
      normalizeGetAuthorizedPatientsQuery({
        page: '3',
        limit: String(MAX_AUTHORIZED_PATIENTS_LIMIT),
      }),
    ).toEqual({ page: 3, limit: 100 });
  });

  it.each([
    ['page', { page: '0' }],
    ['page', { page: '-1' }],
    ['page', { page: 'abc' }],
    ['page', { page: '1.5' }],
    ['limit', { limit: '0' }],
    ['limit', { limit: 'invalid' }],
    ['limit', { limit: '101' }],
  ])('rejects invalid %s', (parameter, query) => {
    expect(() => normalizeGetAuthorizedPatientsQuery(query)).toThrow(
      new BadRequestException({
        status: 'ERROR',
        message: `Parâmetro inválido: ${parameter}`,
      }),
    );
  });
});
