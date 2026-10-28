// Este arquivo define e normaliza os parâmetros da listagem de contas.
// Os filtros são opcionais: sem filtros, a listagem traz todas as contas.

import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import {
  PaginationQueryDto,
  invalidParameter,
} from '../../common/pagination/pagination-query.dto';

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
 * Parâmetros da listagem de contas, já normalizados pelo pipe.
 */
export class GetAccountsRequestDto extends PaginationQueryDto {
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
}
