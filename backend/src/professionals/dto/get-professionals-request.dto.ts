// Este arquivo define e normaliza os parâmetros da consulta de profissionais.
// A validação acontece antes do service para impedir que valores inválidos
// alcancem a consulta ao banco.

import { BadRequestException } from '@nestjs/common';
import { Specialism } from '../../database/enums/specialism.enum';

/** Página usada quando a consulta não informa paginação. */
export const DEFAULT_PROFESSIONALS_PAGE = 1;

/** Quantidade de profissionais retornada por página por padrão. */
export const DEFAULT_PROFESSIONALS_LIMIT = 10;

/** Maior quantidade de profissionais permitida em uma página. */
export const MAX_PROFESSIONALS_LIMIT = 100;

/** Identificador UUID de um perfil profissional. */
export type ProfessionalId = string;

/** Valores de especialidade aceitos pelo contrato da consulta. */
export type ProfessionalSpecialism = Specialism;

/** Parâmetros normalizados usados pelo service de profissionais. */
export interface GetProfessionalsRequestDto {
  page: number;
  limit: number;
  name?: string;
  specialism?: Specialism;
  ids?: ProfessionalId[];
}

/**
 * Valores recebidos pelo controller na query string.
 *
 * A paginação pode chegar como texto HTTP e `ids` pode ser uma lista
 * separada por vírgulas ou uma lista produzida pelo adaptador HTTP.
 */
export interface GetProfessionalsQuery {
  page?: string | number;
  limit?: string | number;
  name?: string;
  specialism?: string;
  ids?: string | string[];
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Cria a exceção padrão para um parâmetro de consulta inválido. */
function invalidParameter(parameter: string): BadRequestException {
  return new BadRequestException({
    status: 'ERROR',
    message: `Parâmetro inválido: ${parameter}`,
  });
}

/**
 * Converte e valida um parâmetro inteiro positivo de paginação.
 *
 * @param value valor recebido na query string
 * @param parameter nome do parâmetro para a mensagem de erro
 * @param defaultValue valor usado quando o parâmetro não é informado
 * @returns valor inteiro normalizado
 * @throws BadRequestException quando o valor não é válido
 */
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

  if (parameter === 'limit' && parsed > MAX_PROFESSIONALS_LIMIT) {
    throw invalidParameter(parameter);
  }

  return parsed;
}

/**
 * Remove espaços externos do nome e impede buscas sem conteúdo.
 *
 * @param name nome recebido na query string
 * @returns nome normalizado ou `undefined` quando não informado
 * @throws BadRequestException quando o nome contém apenas espaços
 */
function normalizeName(name: string | undefined): string | undefined {
  if (name === undefined) {
    return undefined;
  }

  const normalized = name.trim();

  if (normalized === '') {
    throw invalidParameter('name');
  }

  return normalized;
}

/**
 * Converte a lista de IDs da query para UUIDs únicos e normalizados.
 *
 * @param ids string separada por vírgulas ou lista recebida na query
 * @returns IDs únicos ou `undefined` quando o filtro não foi informado
 * @throws BadRequestException quando um ID não é um UUID válido
 */
function normalizeIds(
  ids: string | string[] | undefined,
): ProfessionalId[] | undefined {
  if (ids === undefined) {
    return undefined;
  }

  const values = (Array.isArray(ids) ? ids : ids.split(','))
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter((value) => value !== '');

  const uniqueIds = [...new Set(values)];

  if (uniqueIds.length === 0) {
    return undefined;
  }

  if (uniqueIds.some((id) => !UUID_PATTERN.test(id))) {
    throw invalidParameter('ids');
  }

  return uniqueIds;
}

/**
 * Valida a especialidade contra os valores persistidos no enum do banco.
 *
 * @param specialism valor técnico recebido na query
 * @returns especialidade normalizada ou `undefined` quando não informada
 * @throws BadRequestException quando a especialidade não existe
 */
function normalizeSpecialism(
  specialism: string | undefined,
): Specialism | undefined {
  if (specialism === undefined || specialism === '') {
    return undefined;
  }

  if (!Object.values(Specialism).includes(specialism as Specialism)) {
    throw invalidParameter('specialism');
  }

  return specialism as Specialism;
}

/**
 * Normaliza os filtros e a paginação da consulta de profissionais.
 *
 * Esta função fica antes da camada de persistência para impedir que valores
 * inválidos alcancem a consulta ao banco.
 *
 * @param query parâmetros brutos recebidos pelo controller
 * @returns parâmetros validados para o service
 * @throws BadRequestException quando qualquer parâmetro é inválido
 */
export function normalizeGetProfessionalsQuery(
  query: GetProfessionalsQuery,
): GetProfessionalsRequestDto {
  return {
    page: parsePositiveInteger(query.page, 'page', DEFAULT_PROFESSIONALS_PAGE),
    limit: parsePositiveInteger(
      query.limit,
      'limit',
      DEFAULT_PROFESSIONALS_LIMIT,
    ),
    name: normalizeName(query.name),
    specialism: normalizeSpecialism(query.specialism),
    ids: normalizeIds(query.ids),
  };
}
