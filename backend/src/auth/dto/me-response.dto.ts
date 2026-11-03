// Este arquivo define a resposta do GET /me.

import { ApiProperty } from '@nestjs/swagger';
import { AccountRole } from '../../accounts/enums/account-role.enum';

/** Dados públicos da conta da sessão atual. */
export class MeResponseDto {
  @ApiProperty({ example: '3e4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a6b' })
  accountId: string;

  @ApiProperty({ example: 'Kaio Felipe' })
  name: string;

  @ApiProperty({ example: 'kaio.felipe@example.com' })
  email: string;

  @ApiProperty({ enum: AccountRole, example: AccountRole.User })
  role: AccountRole;

  /** Perfil de paciente da conta, ou null quando ela não tem. */
  @ApiProperty({
    example: null,
    nullable: true,
    type: String,
  })
  patientProfileId: string | null;

  @ApiProperty({
    type: [String],
    example: ['5d1c2b3a-4e5f-4a6b-8c7d-9e0f1a2b3c4d'],
  })
  professionalProfileIds: string[];
}
