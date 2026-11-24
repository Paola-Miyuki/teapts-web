// Este arquivo define o contrato do detalhe de uma conta (modal "Dados da
// conta" da tela de Contas).

import { ApiProperty } from '@nestjs/swagger';
import { Specialism } from '../../professionals/enums/specialism.enum';
import { AccountRole } from '../enums/account-role.enum';
import { AccountStatus } from '../enums/account-status.enum';
import { Gender } from '../enums/gender.enum';
import { Sex } from '../enums/sex.enum';
import {
  ACCOUNT_PROFILE_TYPES,
  type AccountProfileType,
} from './get-accounts-response.dto';

/** Perfil da conta e, no profissional, as especialidades. */
export class AccountProfileResponseDto {
  @ApiProperty({ enum: ACCOUNT_PROFILE_TYPES, example: 'professional' })
  type: AccountProfileType;
  @ApiProperty({ enum: Specialism, isArray: true, example: ['psychologist'] })
  specialisms: string[];
}

/** Dados da conta para o administrador. */
export class GetAccountResponseDto {
  id: string;
  /** Nome completo. */
  fullName: string;
  @ApiProperty({ type: String, nullable: true, example: null })
  socialName: string | null;
  /** `AAAA-MM-DD`; nula só na conta de administrador e nas contas antigas. */
  @ApiProperty({ type: String, nullable: true, example: '1990-05-20' })
  birthDate: string | null;
  @ApiProperty({ enum: Sex, nullable: true, example: Sex.Female })
  sex: Sex | null;
  @ApiProperty({ enum: Gender, nullable: true, example: null })
  gender: Gender | null;
  /** Só dígitos; nulo na conta de administrador. */
  @ApiProperty({ type: String, nullable: true, example: '52998224725' })
  cpf: string | null;
  email: string;
  /** Só dígitos, com DDD. */
  @ApiProperty({ type: String, nullable: true, example: '11987654321' })
  phone: string | null;
  @ApiProperty({ enum: AccountRole, example: 'user' })
  role: AccountRole;
  @ApiProperty({ enum: AccountStatus, example: 'active' })
  status: AccountStatus;
  /** @example 2026-11-10T15:00:00.000Z */
  createdAt: string;
  /** Nulo se a conta nunca foi atualizada. */
  @ApiProperty({ type: String, nullable: true, example: null })
  updatedAt: string | null;
  profile: AccountProfileResponseDto;
}
