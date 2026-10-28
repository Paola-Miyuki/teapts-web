// Este arquivo define o contrato público da consulta de profissionais.
// Os tipos expostos incluem somente os dados necessários para identificação
// e seleção, sem transportar a entidade Account completa.
// São classes, e não interfaces, para aparecerem no OpenAPI; o JSON da
// resposta é o mesmo.

import { Specialism } from '../enums/specialism.enum';

/** Dados públicos de uma especialidade retornados na seleção profissional. */
export class ProfessionalSpecialismResponseDto {
  /** @example psychologist */
  id: Specialism;
  name: string;
}

/** Dados necessários para identificar e selecionar um profissional. */
export class ProfessionalSummaryResponseDto {
  id: string;
  name: string;
  email: string;
  specialism: ProfessionalSpecialismResponseDto;
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
