// Este arquivo define a resposta do GET /me.

import { ApiProperty } from '@nestjs/swagger';
import { AccountRole } from '../../accounts/enums/account-role.enum';
import { Gender } from '../../accounts/enums/gender.enum';
import { Sex } from '../../accounts/enums/sex.enum';

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

  @ApiProperty({ type: String, nullable: true, example: null })
  socialName: string | null;

  /** `AAAA-MM-DD`; nula só na conta de administrador e nas contas antigas. */
  @ApiProperty({ type: String, nullable: true, example: '1990-05-20' })
  birthDate: string | null;

  @ApiProperty({ enum: Sex, nullable: true, example: Sex.Male })
  sex: Sex | null;

  @ApiProperty({ enum: Gender, nullable: true, example: null })
  gender: Gender | null;

  /** Só dígitos; nulo na conta de administrador (RN001). */
  @ApiProperty({ type: String, nullable: true, example: '52998224725' })
  cpf: string | null;

  /** Só dígitos, com DDD. */
  @ApiProperty({ type: String, nullable: true, example: '11987654321' })
  phone: string | null;

  @ApiProperty({ example: '2026-11-23T12:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  updatedAt: string | null;

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
