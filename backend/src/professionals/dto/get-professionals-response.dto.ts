// Este arquivo define o contrato público da consulta de profissionais.
// Os tipos expostos incluem somente os dados necessários para identificação
// e seleção, sem transportar a entidade Account completa.
// São classes, e não interfaces, para aparecerem no OpenAPI; o JSON da
// resposta é o mesmo.

import { ApiProperty } from '@nestjs/swagger';
import { Specialism } from '../enums/specialism.enum';
import { UFS, type Uf } from '../enums/uf.enum';

/** Dados públicos de uma especialidade retornados na seleção profissional. */
export class ProfessionalSpecialismResponseDto {
  /** @example psychologist */
  id: Specialism;
  name: string;
}

/** Registro no conselho regional; o conselho vem da especialidade. */
export class ProfessionalRegistrationResponseDto {
  /** @example CRP */
  council: string;
  /** @example 12345 */
  number: string;
  @ApiProperty({ enum: UFS, example: 'PR' })
  state: Uf;
}

/** Dados necessários para identificar e selecionar um profissional. */
export class ProfessionalSummaryResponseDto {
  id: string;
  name: string;
  /** Só para o admin e o profissional; `null` para as outras contas (DP011). */
  email: string | null;
  specialism: ProfessionalSpecialismResponseDto;
  /** `null` nos perfis cadastrados antes do registro no conselho. */
  @ApiProperty({ type: ProfessionalRegistrationResponseDto, nullable: true })
  registration: ProfessionalRegistrationResponseDto | null;
  /** Instituição ou serviço de vínculo. */
  @ApiProperty({ type: String, nullable: true, example: 'IMA' })
  institution: string | null;
  /** CNES, 7 dígitos. */
  @ApiProperty({ type: String, nullable: true, example: '2771112' })
  cnes: string | null;
}

/** Dados da paginação da consulta. */
export class ProfessionalsPaginationResponseDto {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Resposta paginada da consulta de profissionais. */
export class GetProfessionalsResponseDto {
  data: ProfessionalSummaryResponseDto[];
  pagination: ProfessionalsPaginationResponseDto;
}
