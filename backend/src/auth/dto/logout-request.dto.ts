// Este arquivo define o corpo do POST /auth/logout.

import { IsBoolean, IsOptional } from 'class-validator';

/** Corpo opcional do logout; sem `allSessions`, só a sessão atual é revogada. */
export class LogoutRequestDto {
  @IsOptional()
  @IsBoolean({ message: 'Parâmetro inválido: allSessions' })
  allSessions?: boolean;
}
