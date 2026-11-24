// Este arquivo testa a validação e a normalização dos parâmetros da consulta
// de profissionais antes que eles sejam enviados para a camada de persistência.

import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import { Specialism } from '../enums/specialism.enum';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from '../../common/pagination/pagination-query.dto';
import { GetProfessionalsRequestDto } from './get-professionals-request.dto';

// A query passa pelo mesmo pipe global usado pela aplicação.
function normalize(query: Record<string, unknown>) {
  return createValidationPipe().transform(query, {
    type: 'query',
    metatype: GetProfessionalsRequestDto,
  }) as Promise<GetProfessionalsRequestDto>;
}

// O teste cobre a normalização e a validação antes da consulta ao banco.
describe('GetProfessionalsRequestDto', () => {
  // Garante que a consulta use os valores padrão quando a paginação não é informada.
  it('applies the default pagination', async () => {
    await expect(normalize({})).resolves.toEqual({
      page: DEFAULT_PAGE,
      limit: DEFAULT_PAGE_LIMIT,
      q: undefined,
      specialism: undefined,
      council: undefined,
      councilState: undefined,
      sort: undefined,
      order: undefined,
      ids: undefined,
    });
  });

  // Parâmetros vazios na URL (`?page=&limit=&specialism=`) usam os padrões.
  it('treats empty pagination and specialism as not informed', async () => {
    const result = await normalize({
      page: '',
      limit: '',
      specialism: '',
      council: '',
      q: '   ',
    });

    expect(result).toMatchObject({
      page: DEFAULT_PAGE,
      limit: DEFAULT_PAGE_LIMIT,
    });
    expect(result.specialism).toBeUndefined();
    expect(result.council).toBeUndefined();
    expect(result.q).toBeUndefined();
  });

  // Confirma a conversão dos valores da query e a normalização dos filtros válidos.
  it('normalizes valid filters', async () => {
    await expect(
      normalize({
        page: '2',
        limit: '20',
        q: '  Maria  ',
        specialism: `${Specialism.Psychologist},${Specialism.Doctor}`,
        council: ['CRP', 'CRM'],
        councilState: 'pr',
        sort: 'specialism',
        order: 'desc',
        ids: [
          '550e8400-e29b-41d4-a716-446655440000',
          '550e8400-e29b-41d4-a716-446655440000',
        ],
      }),
    ).resolves.toEqual({
      page: 2,
      limit: 20,
      q: 'Maria',
      specialism: [Specialism.Psychologist, Specialism.Doctor],
      council: ['CRP', 'CRM'],
      councilState: 'pr',
      sort: 'specialism',
      order: 'desc',
      ids: ['550e8400-e29b-41d4-a716-446655440000'],
    });
  });

  // Aceita IDs separados por vírgulas e remove valores vazios da lista.
  it('parses comma-separated ids and ignores empty values', async () => {
    await expect(
      normalize({ ids: ',550e8400-e29b-41d4-a716-446655440000, ' }),
    ).resolves.toMatchObject({
      ids: ['550e8400-e29b-41d4-a716-446655440000'],
    });
  });

  // Não envia filtro de IDs quando a entrada contém somente valores vazios.
  it('does not create an ids filter when all values are empty', async () => {
    const result = await normalize({ ids: ', ' });

    expect(result.ids).toBeUndefined();
  });

  // Impede que parâmetros inválidos alcancem a consulta ao banco.
  it.each([
    ['page', { page: '0' }],
    ['page', { page: '1.5' }],
    ['limit', { limit: '0' }],
    ['limit', { limit: String(MAX_PAGE_LIMIT + 1) }],
    ['limit', { limit: 'invalid' }],
    ['q', { q: ['a', 'b'] }],
    ['specialism', { specialism: 'invalid' }],
    ['specialism', { specialism: 'doctor,invalid' }],
    ['council', { council: 'CRX' }],
    ['councilState', { councilState: 'xx' }],
    ['sort', { sort: 'email' }],
    ['order', { order: 'up' }],
    ['ids', { ids: 'not-a-uuid' }],
  ])('rejects an invalid %s parameter', async (parameter, query) => {
    const error: unknown = await normalize(query).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toEqual({
      status: 'ERROR',
      message: `Parâmetro inválido: ${parameter}`,
    });
  });

  // Com a paginação herdada do PaginationQueryDto, os filtros da rota são
  // validados antes de page e limit; o primeiro inválido é o reportado.
  it('reports the first invalid parameter in validation order', async () => {
    const error: unknown = await normalize({
      ids: 'not-a-uuid',
      limit: '0',
    }).catch((e: unknown) => e);

    expect((error as BadRequestException).getResponse()).toMatchObject({
      message: 'Parâmetro inválido: ids',
    });
  });
});
