// Este arquivo define o contrato público da consulta de pacientes autorizados.
// São classes, e não interfaces, para aparecerem no OpenAPI; o JSON da
// resposta é o mesmo.

import { ApiProperty } from '@nestjs/swagger';
import { PaginationResponseDto } from '../../common/pagination/pagination-response.dto';
import { PtsStateEnum } from '../../database/enums/pts-state.enum';

export class AuthorizedPatientResponseDto {
  id: string;
  name: string;
  socialName: string | null;
  email: string;
  cns: string | null;
  guardianName: string | null;
  /** Data e hora em que a conta virou paciente (ISO 8601). */
  registeredAt: string;

  /**
   * Status do PTS que a lista mostra: o PTS ativo; sem ele, o mais recente sem
   * contar os rejeitados; só com rejeitados, `rejected`; sem PTS, `null`.
   */
  @ApiProperty({ enum: PtsStateEnum, nullable: true })
  ptsStatus: PtsStateEnum | null;

  /** PTS em planejamento ou em andamento, quando houver. */
  activePtsId: string | null;

  /**
   * Para o profissional, `true` quando o acesso vem só de PTS concluído ou
   * cancelado (sem edição, RN024); para o admin, sempre `false`.
   */
  readOnly: boolean;
}

export class GetAuthorizedPatientsResponseDto {
  data: AuthorizedPatientResponseDto[];
  pagination: PaginationResponseDto;
}
