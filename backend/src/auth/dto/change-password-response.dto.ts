// Este arquivo define a resposta do POST /me/password.

import { ApiProperty } from '@nestjs/swagger';

/** Corpo devolvido quando a senha foi trocada no SuperTokens. */
export class ChangePasswordResponseDto {
  @ApiProperty({ enum: ['OK'] })
  status: 'OK';
}
