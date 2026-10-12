// Este arquivo define o contrato público da consulta de profissionais.
// Os tipos expostos incluem somente os dados necessários para identificação
// e seleção, sem transportar a entidade Account completa.

import type { ProfessionalSpecialism } from './get-professionals-request.dto';

/** Dados públicos de uma especialidade retornados na seleção profissional. */
export interface ProfessionalSpecialismResponseDto {
  id: ProfessionalSpecialism;
  name: string;
}

/** Dados necessários para identificar e selecionar um profissional. */
export interface ProfessionalSummaryResponseDto {
  id: string;
  name: string;
  email: string;
  specialism: ProfessionalSpecialismResponseDto;
}

/** Resposta paginada da consulta de profissionais. */
export interface GetProfessionalsResponseDto {
  data: ProfessionalSummaryResponseDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
