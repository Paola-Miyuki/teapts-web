// Este arquivo define o contrato público da consulta de pacientes autorizados.

export interface AuthorizedPatientResponseDto {
  id: string;
  name: string;
}

export interface GetAuthorizedPatientsResponseDto {
  data: AuthorizedPatientResponseDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
