import { IsEmail, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateAccountDto {
  @IsUUID()
  @IsNotEmpty({ message: 'O ID do SuperTokens é obrigatório' })
  supertokensUserId: string;

  @IsEmail({}, { message: 'Informe um e-mail válido' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'O nome é obrigatório' })
  name: string;
}
