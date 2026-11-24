// Este arquivo define o contrato público do perfil profissional criado.
// É classe, e não interface, para aparecer no OpenAPI.

import { ApiProperty } from '@nestjs/swagger';
import {
  ProfessionalRegistrationResponseDto,
  ProfessionalSpecialismResponseDto,
} from './get-professionals-response.dto';

/** Perfil profissional criado, com os dados públicos da conta. */
export class ProfessionalProfileResponseDto {
  /** @example 7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f */
  id: string;
  /** @example 0b6f5a4e-2c1d-4e8f-9a7b-3c2d1e0f9a8b */
  accountId: string;
  name: string;
  email: string;
  specialism: ProfessionalSpecialismResponseDto;
  /** Registro no conselho; o conselho vem da especialidade. */
  @ApiProperty({ type: ProfessionalRegistrationResponseDto })
  registration: ProfessionalRegistrationResponseDto;
  /** Instituição ou serviço de vínculo. */
  @ApiProperty({ type: String, nullable: true, example: 'CAPSi Boa Vista' })
  institution: string | null;
  /** CNES, 7 dígitos. */
  @ApiProperty({ type: String, nullable: true, example: '1234567' })
  cnes: string | null;
  /** Data da desativação (RFPRO004); `null` enquanto ativo. */
  deactivatedAt: string | null;
}
