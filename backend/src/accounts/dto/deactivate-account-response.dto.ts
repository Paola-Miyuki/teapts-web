// Este arquivo define o contrato da resposta da desativação de conta.

import { ApiProperty } from '@nestjs/swagger';
import { AccountStatus } from '../enums/account-status.enum';

/** Conta desativada (exclusão lógica, RN021). */
export class DeactivateAccountResponseDto {
  id: string;
  @ApiProperty({ enum: [AccountStatus.Inactive], example: 'inactive' })
  status: AccountStatus.Inactive;
  /** @example 2026-11-10T15:00:00.000Z */
  deactivatedAt: string;
}
