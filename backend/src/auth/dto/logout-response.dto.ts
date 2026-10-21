// Este arquivo define a resposta do POST /auth/logout.

import { ApiProperty } from '@nestjs/swagger';

/** Mesmo corpo do signout do SDK do SuperTokens. */
export class LogoutResponseDto {
  @ApiProperty({ enum: ['OK'] })
  status: 'OK';
}
