// Este arquivo define o contrato público da consulta de pacientes autorizados.
// São classes, e não interfaces, para aparecerem no OpenAPI; o JSON da
// resposta é o mesmo.

import { PaginationResponseDto } from '../../common/pagination/pagination-response.dto';

/** Dados necessários para identificar e selecionar um paciente. */
export class AuthorizedPatientResponseDto {
  id: string;
  name: string;
}

/** Resposta paginada da consulta de pacientes autorizados. */
export class GetAuthorizedPatientsResponseDto {
  data: AuthorizedPatientResponseDto[];
  pagination: PaginationResponseDto;
}
