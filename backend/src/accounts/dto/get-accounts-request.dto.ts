// Este arquivo define e normaliza os parâmetros da listagem de contas.
// A busca e os filtros são opcionais: sem eles, a listagem traz todas as
// contas.

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  type ValidationOptions,
} from 'class-validator';
import {
  PaginationQueryDto,
  invalidParameter,
} from '../../common/pagination/pagination-query.dto';
import { AccountStatus } from '../enums/account-status.enum';

/** Perfis filtráveis na listagem; `none` é a conta sem perfil nem admin. */
export const ACCOUNT_PROFILE_FILTERS = [
  'none',
  'patient',
  'professional',
  'admin',
] as const;
export type AccountProfileFilter = (typeof ACCOUNT_PROFILE_FILTERS)[number];

export const ACCOUNT_SORT_FIELDS = ['name', 'createdAt'] as const;
export type AccountSortField = (typeof ACCOUNT_SORT_FIELDS)[number];

export const ACCOUNT_SORT_ORDERS = ['asc', 'desc'] as const;
export type AccountSortOrder = (typeof ACCOUNT_SORT_ORDERS)[number];

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function invalidEach(parameter: string): ValidationOptions {
  return { ...invalidParameter(parameter), each: true };
}

/** Texto opcional: espaços externos saem, e vazio equivale a sem filtro. */
function toOptionalText({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim() || undefined;
}

/** Aceita `profile=a,b` ou `profile=a&profile=b`; vazio equivale a sem filtro. */
function toProfileList({ value }: { value: unknown }): unknown {
  if (value === undefined) {
    return undefined;
  }

  const values = (Array.isArray(value) ? value : [value]).flatMap((item) =>
    typeof item === 'string' ? item.split(',') : [item],
  );
  const profiles = values
    .map((item) => (typeof item === 'string' ? item.trim() : item))
    .filter((item) => item !== '');

  return profiles.length > 0 ? [...new Set(profiles)] : undefined;
}

/**
 * Converte `'true'`/`'false'` da query para boolean. Vazio vira filtro não
 * informado; outro valor segue como está e falha no `IsBoolean`.
 */
function toBoolean({ value }: { value: unknown }): unknown {
  if (value === '') {
    return undefined;
  }

  if (value === 'true') {
    return true;
  }

  return value === 'false' ? false : value;
}

/**
 * Remove os espaços externos da busca; vazio ou só espaços viram busca não
 * informada (NFUS003). Outro tipo segue como está e falha no `IsString`.
 */
function toSearchTerm({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const term = value.trim();

  return term === '' ? undefined : term;
}

/**
 * Parâmetros da listagem de contas, já normalizados pelo pipe.
 */
export class GetAccountsRequestDto extends PaginationQueryDto {
  /**
   * Busca parcial por nome, nome social, e-mail ou CPF (com ou sem
   * pontuação), sem diferenciar maiúsculas.
   * @example mari
   */
  @Transform(toSearchTerm)
  @IsOptional()
  @IsString(invalidParameter('q'))
  q?: string;

  /** `true`: só contas com perfil de paciente; `false`: só contas sem. */
  @Transform(toBoolean)
  @IsOptional()
  @IsBoolean(invalidParameter('isPatient'))
  isPatient?: boolean;

  /** `true`: só contas com perfil profissional; `false`: só contas sem. */
  @Transform(toBoolean)
  @IsOptional()
  @IsBoolean(invalidParameter('isProfessional'))
  isProfessional?: boolean;

  @ApiPropertyOptional({
    description:
      'Perfis da conta, separados por vírgula ou repetidos; `none` é a conta sem perfil de paciente nem profissional e que não é admin.',
    enum: ACCOUNT_PROFILE_FILTERS,
    isArray: true,
  })
  @Transform(toProfileList)
  @IsOptional()
  @IsIn(ACCOUNT_PROFILE_FILTERS, invalidEach('profile'))
  profile?: AccountProfileFilter[];

  @ApiPropertyOptional({
    description: 'Situação da conta; omitido traz as duas.',
    enum: AccountStatus,
  })
  @Transform(toOptionalText)
  @IsOptional()
  @IsIn(Object.values(AccountStatus), invalidParameter('status'))
  status?: AccountStatus;

  @ApiPropertyOptional({
    description: 'Data de criação a partir de (AAAA-MM-DD), inclusive.',
    example: '2026-10-01',
  })
  @Transform(toOptionalText)
  @IsOptional()
  @Matches(DATE_ONLY, invalidParameter('createdFrom'))
  @IsISO8601({ strict: true }, invalidParameter('createdFrom'))
  createdFrom?: string;

  @ApiPropertyOptional({
    description: 'Data de criação até (AAAA-MM-DD), inclusive.',
    example: '2026-11-24',
  })
  @Transform(toOptionalText)
  @IsOptional()
  @Matches(DATE_ONLY, invalidParameter('createdTo'))
  @IsISO8601({ strict: true }, invalidParameter('createdTo'))
  createdTo?: string;

  @ApiPropertyOptional({ enum: ACCOUNT_SORT_FIELDS, default: 'name' })
  @Transform(toOptionalText)
  @IsOptional()
  @IsIn(ACCOUNT_SORT_FIELDS, invalidParameter('sort'))
  sort?: AccountSortField;

  @ApiPropertyOptional({ enum: ACCOUNT_SORT_ORDERS, default: 'asc' })
  @Transform(toOptionalText)
  @IsOptional()
  @IsIn(ACCOUNT_SORT_ORDERS, invalidParameter('order'))
  order?: AccountSortOrder;
}
