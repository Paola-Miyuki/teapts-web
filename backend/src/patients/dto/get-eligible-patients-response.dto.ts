// Este arquivo define o contrato público da busca de pacientes elegíveis. O
// CPF serve só para achar o paciente e não volta (DP011). São classes, e não
// interfaces, para aparecerem no OpenAPI.

import { PaginationResponseDto } from '../../common/pagination/pagination-response.dto';

export class EligiblePatientResponseDto {
  id: string;
  /** Nome exibido: o nome social, quando houver, ou o nome completo. */
  name: string;
  email: string;
}

export class GetEligiblePatientsResponseDto {
  data: EligiblePatientResponseDto[];
  pagination: PaginationResponseDto;
}
