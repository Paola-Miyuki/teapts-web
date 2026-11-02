// Este arquivo expõe as rotas de autenticação próprias da aplicação.
// O login continua sendo o POST /auth/signin oficial do SuperTokens.
// Aqui existem GET /me, que consulta a conta da sessão já validada, e
// POST /auth/logout, que substitui o /auth/signout do SDK (desligado).
// Não há endpoint de login próprio para evitar duplicar regras de autenticação.

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiOperation,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { SessionRequest } from 'supertokens-node/framework/express';
import { AuthGuard } from '../guards/auth.guard';
import { CurrentAccount } from '../decorators/current-account.decorator';
import { LogoutRequestDto } from '../dto/logout-request.dto';
import { LogoutResponseDto } from '../dto/logout-response.dto';
import { MeResponseDto } from '../dto/me-response.dto';
import { ChangePasswordRequestDto } from '../dto/change-password-request.dto';
import { UpdateMeRequestDto } from '../dto/update-me-request.dto';
import { processLogout } from '../services/supertokens.service';
import { AccountsService } from '../../accounts/services/accounts.service';
import type { AccountContext } from '../../accounts/services/accounts.service';
import {
  ErrorResponseDto,
  UnauthorizedResponseDto,
} from '../../common/swagger/error-response.dto';

/**
 * Expõe endpoints da aplicação que dependem de uma sessão válida.
 *
 * @param accountsService serviço que busca os dados atuais da conta
 */
@ApiTags('auth')
@ApiCookieAuth()
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: UnauthorizedResponseDto })
@Controller()
export class AuthController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: MeResponseDto })
  /**
   * Retorna os dados da conta atual, identificada pelo contexto da sessão.
   *
   * O contexto vai na sessão para evitar uma consulta ao banco a cada
   * requisição protegida; o banco ainda é consultado aqui para dados atuais.
   *
   * @param account contexto validado pelo AuthGuard e entregue pelo decorator
   * @returns dados públicos da conta atual
   * @throws UnauthorizedException quando a conta não pode ser encontrada
   */
  async getMe(
    @CurrentAccount() account: AccountContext,
  ): Promise<MeResponseDto> {
    const accountDetails = await this.accountsService.findById(
      account.accountId,
    );

    return {
      accountId: account.accountId,
      name: accountDetails.name,
      email: accountDetails.email,
      role: accountDetails.role,
      patientProfileId: account.patientProfileId,
      professionalProfileIds: account.professionalProfileIds,
    };
  }

  @Patch('me')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Atualiza os dados da conta atual' })
  @ApiBody({ type: UpdateMeRequestDto })
  @ApiOkResponse({ type: MeResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    example: {
      status: 'VALIDATION_ERROR',
      message: 'Informe um e-mail válido.',
    },
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    example: {
      status: 'FORBIDDEN',
      message: 'Não é permitido alterar o papel da conta.',
    },
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    example: {
      status: 'EMAIL_ALREADY_EXISTS',
      message: 'Este e-mail já está cadastrado.',
    },
  })
  async updateMe(
    @CurrentAccount() account: AccountContext,
    @Body() body: UpdateMeRequestDto,
  ): Promise<MeResponseDto> {
    return this.accountsService.updateMe(account, body);
  }

  @Post('me/password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Altera a senha da conta atual' })
  @ApiBody({ type: ChangePasswordRequestDto })
  @ApiOkResponse({ type: LogoutResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    examples: {
      validation: {
        summary: 'Política de senha',
        value: {
          status: 'VALIDATION_ERROR',
          message: 'A senha deve conter pelo menos 8 caracteres.',
        },
      },
      currentPassword: {
        summary: 'Senha atual inválida',
        value: {
          status: 'INVALID_CURRENT_PASSWORD',
          message: 'A senha atual está incorreta.',
        },
      },
    },
  })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    example: {
      status: 'FORBIDDEN',
      message: 'Operação não permitida.',
    },
  })
  async changePassword(
    @CurrentAccount() account: AccountContext,
    @Body() body: ChangePasswordRequestDto,
  ): Promise<LogoutResponseDto> {
    return this.accountsService.changePassword(account, body);
  }

  @Post('auth/logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: LogoutResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    example: {
      status: 'VALIDATION_ERROR',
      message: 'Parâmetro inválido: allSessions',
    },
  })
  /**
   * Encerra a sessão atual e, com `allSessions: true`, todas as do usuário.
   *
   * O AuthGuard valida a sessão no banco (checkDatabase), então uma sessão já
   * revogada recebe 401, que o frontend trata como logout concluído.
   *
   * @param req requisição com a sessão anexada pelo AuthGuard
   * @param body corpo validado pelo ValidationPipe global
   * @returns `{ status: 'OK' }`, o mesmo corpo do signout do SDK
   * @throws UnauthorizedException quando não há sessão na requisição
   */
  async logout(
    @Req() req: SessionRequest,
    @Body() body: LogoutRequestDto,
  ): Promise<LogoutResponseDto> {
    if (!req.session) {
      throw new UnauthorizedException('Sessão não validada');
    }

    await processLogout(req.session, body.allSessions === true);

    return { status: 'OK' };
  }
}
