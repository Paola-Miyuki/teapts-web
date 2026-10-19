// Este arquivo define e normaliza a paginação dos pacientes autorizados.

import { BadRequestException } from '@nestjs/common';

export const DEFAULT_AUTHORIZED_PATIENTS_PAGE = 1;
export const DEFAULT_AUTHORIZED_PATIENTS_LIMIT = 10;
export const MAX_AUTHORIZED_PATIENTS_LIMIT = 100;

export interface GetAuthorizedPatientsRequestDto {
  page: number;
  limit: number;
}

export interface GetAuthorizedPatientsQuery {
  page?: string | number;
  limit?: string | number;
}

function invalidParameter(parameter: 'page' | 'limit'): BadRequestException {
  return new BadRequestException({
    status: 'ERROR',
    message: `Parâmetro inválido: ${parameter}`,
  });
}

function parsePositiveInteger(
  value: string | number | undefined,
  parameter: 'page' | 'limit',
  defaultValue: number,
): number {
  if (value === undefined || value === '') {
    return defaultValue;
  }

  const parsed = typeof value === 'number' ? value : Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw invalidParameter(parameter);
  }

  if (parameter === 'limit' && parsed > MAX_AUTHORIZED_PATIENTS_LIMIT) {
    throw invalidParameter(parameter);
  }

  return parsed;
}

export function normalizeGetAuthorizedPatientsQuery(
  query: GetAuthorizedPatientsQuery,
): GetAuthorizedPatientsRequestDto {
  return {
    page: parsePositiveInteger(
      query.page,
      'page',
      DEFAULT_AUTHORIZED_PATIENTS_PAGE,
    ),
    limit: parsePositiveInteger(
      query.limit,
      'limit',
      DEFAULT_AUTHORIZED_PATIENTS_LIMIT,
    ),
  };
}
