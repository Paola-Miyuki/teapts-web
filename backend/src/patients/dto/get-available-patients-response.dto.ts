// Este arquivo define o contrato público da consulta de pacientes disponíveis
// para um PTS novo. São classes, e não interfaces, para aparecerem no OpenAPI.

import { PaginationResponseDto } from '../../common/pagination/pagination-response.dto';

export class AvailablePatientResponseDto {
  id: string;
  name: string;
}

export class GetAvailablePatientsResponseDto {
  data: AvailablePatientResponseDto[];
  pagination: PaginationResponseDto;
}
