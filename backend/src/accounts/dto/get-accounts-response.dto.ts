// Este arquivo define o contrato público da listagem e do detalhe de contas.
// Só expõe o necessário para a tela de Contas e para escolher a conta, sem a
// entidade Account.

import { ApiProperty } from '@nestjs/swagger';
import { PaginationResponseDto } from '../../common/pagination/pagination-response.dto';
import { Specialism } from '../../professionals/enums/specialism.enum';
import { AccountRole } from '../enums/account-role.enum';
import { AccountStatus } from '../enums/account-status.enum';

/** Perfil da conta: o do paciente, o do profissional, admin ou nenhum. */
export const ACCOUNT_PROFILE_TYPES = [
  'none',
  'patient',
  'professional',
  'admin',
] as const;
export type AccountProfileType = (typeof ACCOUNT_PROFILE_TYPES)[number];

/** Dados necessários para identificar e listar uma conta. */
export class AccountSummaryResponseDto {
  id: string;
  /** Nome exibido: o nome social, quando houver. */
  name: string;
  @ApiProperty({ type: String, nullable: true, example: null })
  socialName: string | null;
  /** @example maria@exemplo.com */
  email: string;
  /** Só dígitos; nulo na conta de administrador. */
  @ApiProperty({ type: String, nullable: true, example: '52998224725' })
  cpf: string | null;
  @ApiProperty({ enum: AccountRole, example: 'user' })
  role: AccountRole;
  @ApiProperty({ enum: ACCOUNT_PROFILE_TYPES, example: 'professional' })
  profile: AccountProfileType;
  /** Especialidades do perfil profissional; vazio nos demais casos. */
  @ApiProperty({ enum: Specialism, isArray: true, example: ['psychologist'] })
  specialisms: string[];
  /** Situação da conta; a desativada continua na lista do administrador. */
  @ApiProperty({ enum: AccountStatus, example: 'active' })
  status: AccountStatus;
  /** @example 2026-11-10T15:00:00.000Z */
  createdAt: string;
}

/** Resposta paginada da listagem de contas. */
export class GetAccountsResponseDto {
  data: AccountSummaryResponseDto[];
  pagination: PaginationResponseDto;
}
