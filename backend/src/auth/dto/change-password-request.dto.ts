// Este arquivo define o corpo do POST /me/password.

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/** Corpo do `POST /me/password`. */
export class ChangePasswordRequestDto {
  @ApiProperty({ example: 'senha-atual-123' })
  @IsString({ message: 'Informe a senha atual.' })
  @IsNotEmpty({ message: 'Informe a senha atual.' })
  currentPassword: string;

  @ApiProperty({ example: 'nova-senha-456' })
  @IsString({ message: 'Informe a nova senha.' })
  @IsNotEmpty({ message: 'Informe a nova senha.' })
  newPassword: string;
}
