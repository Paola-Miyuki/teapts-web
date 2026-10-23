// Este arquivo descreve, no OpenAPI, os corpos de erro que a API já devolve.
// Só documenta: as respostas continuam sendo montadas pelas exceções do Nest
// e pelo SuperTokens.

import { ApiProperty } from '@nestjs/swagger';

/** Corpo de erro da API (`ValidationPipe` e erros de negócio). */
export class ErrorResponseDto {
  @ApiProperty({ example: 'VALIDATION_ERROR' })
  status: string;

  @ApiProperty({ example: 'Parâmetro inválido: allSessions' })
  message: string;
}

/** Corpo do 401 do SuperTokens quando a sessão falta ou é inválida. */
export class UnauthorizedResponseDto {
  @ApiProperty({
    example: 'unauthorised',
    description:
      '`unauthorised` sem sessão; `try refresh token` com o access token expirado.',
  })
  message: string;
}
