// Este arquivo testa a validação e a normalização dos parâmetros da consulta
// de profissionais antes que eles sejam enviados para a camada de persistência.

import { BadRequestException } from '@nestjs/common';
import { Specialism } from '../../database/enums/specialism.enum';
import {
  DEFAULT_PROFESSIONALS_LIMIT,
  DEFAULT_PROFESSIONALS_PAGE,
  MAX_PROFESSIONALS_LIMIT,
  normalizeGetProfessionalsQuery,
} from './get-professionals-request.dto';

// O teste cobre a normalização e a validação antes da consulta ao banco.
describe('normalizeGetProfessionalsQuery', () => {
  // Garante que a consulta use os valores padrão quando a paginação não é informada.
  it('applies the default pagination', () => {
    expect(normalizeGetProfessionalsQuery({})).toEqual({
      page: DEFAULT_PROFESSIONALS_PAGE,
      limit: DEFAULT_PROFESSIONALS_LIMIT,
      name: undefined,
      specialism: undefined,
      ids: undefined,
    });
  });

  // Confirma a conversão dos valores da query e a normalização dos filtros válidos.
  it('normalizes valid filters', () => {
    expect(
      normalizeGetProfessionalsQuery({
        page: '2',
        limit: '20',
        name: '  Maria  ',
        specialism: Specialism.Psychologist,
        ids: [
          '550e8400-e29b-41d4-a716-446655440000',
          '550e8400-e29b-41d4-a716-446655440000',
        ],
      }),
    ).toEqual({
      page: 2,
      limit: 20,
      name: 'Maria',
      specialism: Specialism.Psychologist,
      ids: ['550e8400-e29b-41d4-a716-446655440000'],
    });
  });

  // Aceita IDs separados por vírgulas e remove valores vazios da lista.
  it('parses comma-separated ids and ignores empty values', () => {
    expect(
      normalizeGetProfessionalsQuery({
        ids: ',550e8400-e29b-41d4-a716-446655440000, ',
      }),
    ).toMatchObject({
      ids: ['550e8400-e29b-41d4-a716-446655440000'],
    });
  });

  // Não envia filtro de IDs quando a entrada contém somente valores vazios.
  it('does not create an ids filter when all values are empty', () => {
    expect(normalizeGetProfessionalsQuery({ ids: ', ' })).toMatchObject({
      ids: undefined,
    });
  });

  // Impede que parâmetros inválidos alcancem a consulta ao banco.
  it.each([
    ['page', { page: '0' }],
    ['page', { page: '1.5' }],
    ['limit', { limit: '0' }],
    ['limit', { limit: String(MAX_PROFESSIONALS_LIMIT + 1) }],
    ['name', { name: '   ' }],
    ['specialism', { specialism: 'invalid' }],
    ['ids', { ids: 'not-a-uuid' }],
  ])('rejects an invalid %s parameter', (_parameter, query) => {
    expect(() => normalizeGetProfessionalsQuery(query)).toThrow(
      BadRequestException,
    );
  });
});
