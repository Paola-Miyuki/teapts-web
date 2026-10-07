import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import { AccountsService } from './accounts.service';
import {
  SIGN_UP_NAME_KEY,
  ACCOUNT_CONTEXT_FLAG,
} from '../auth/supertokens.service';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post('register')
  async register(
    @Body() dto: { name: string; email: string; password: string },
  ) {
    const { name, email, password } = dto;

    if (!name || name.trim() === '') {
      throw new BadRequestException('O nome é obrigatório.');
    }

    // Passa o userContext necessário com a chave SIGN_UP_NAME_KEY
    const signUpResponse = await EmailPassword.signUp(
      'public',
      email,
      password,
      {
        [SIGN_UP_NAME_KEY]: name,
        [ACCOUNT_CONTEXT_FLAG]: true,
      },
    );

    if (signUpResponse.status === 'EMAIL_ALREADY_EXISTS_ERROR') {
      throw new BadRequestException('Este e-mail já está em uso.');
    }

    if (signUpResponse.status !== 'OK') {
      throw new BadRequestException('Erro ao registrar no SuperTokens.');
    }
    return await this.accountsService.findBySupertokensUserId(
      signUpResponse.user.id,
    );
  }
}