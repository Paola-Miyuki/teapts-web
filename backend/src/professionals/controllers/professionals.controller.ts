// Este arquivo expõe as rotas autenticadas de profissionais: a consulta para
// seleção e o cadastro do perfil profissional (só admin).
// O ValidationPipe global valida a query e o corpo, e o controller delega ao
// ProfessionalsService.

import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { CreateProfessionalRequestDto } from '../dto/create-professional-request.dto';
import { GetProfessionalsRequestDto } from '../dto/get-professionals-request.dto';
import { GetProfessionalsResponseDto } from '../dto/get-professionals-response.dto';
import { ProfessionalProfileResponseDto } from '../dto/professional-profile-response.dto';
import {
  ErrorResponseDto,
  UnauthorizedResponseDto,
} from '../../common/swagger/error-response.dto';
import { ProfessionalsService } from '../services/professionals.service';

/**
 * Expõe a consulta autenticada de profissionais para seleção e o cadastro de
 * perfil profissional.
 */
@ApiTags('professionals')
@Controller()
export class ProfessionalsController {
  constructor(private readonly professionalsService: ProfessionalsService) {}

  /**
   * Retorna profissionais filtrados e paginados.
   *
   * A query string é validada e normalizada pelo ValidationPipe global antes
   * de chegar aqui, garantindo que somente parâmetros válidos sejam usados na
   * consulta ao banco.
   *
   * @param query parâmetros já normalizados
   * @returns profissionais compatíveis e dados de paginação
   */
  @Get('professionals')
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  @ApiBearerAuth()
  @ApiOkResponse({ type: GetProfessionalsResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    example: { status: 'ERROR', message: 'Parâmetro inválido: limit' },
  })
  @ApiUnauthorizedResponse({ type: UnauthorizedResponseDto })
  @ApiInternalServerErrorResponse({
    type: ErrorResponseDto,
    example: {
      status: 'ERROR',
      message: 'Não foi possível consultar os profissionais.',
    },
  })
  async findAll(
    @Query() query: GetProfessionalsRequestDto,
  ): Promise<GetProfessionalsResponseDto> {
    return this.professionalsService.findAll(query);
  }

  /**
   * Cria um perfil profissional para uma conta de usuário comum (RFPRO002).
   *
   * @param body conta e especialidade já validadas
   * @returns perfil criado
   */
  @Post('professionals')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiCookieAuth()
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: ProfessionalProfileResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    example: {
      status: 'VALIDATION_ERROR',
      message: 'Informe uma especialidade válida.',
    },
  })
  @ApiUnauthorizedResponse({ type: UnauthorizedResponseDto })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    example: {
      status: 'FORBIDDEN',
      message: 'Acesso restrito ao administrador.',
    },
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    example: { status: 'ACCOUNT_NOT_FOUND', message: 'Conta não encontrada.' },
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    examples: {
      ADMIN_ACCOUNT_NOT_ALLOWED: {
        summary: 'Conta de administrador',
        value: {
          status: 'ADMIN_ACCOUNT_NOT_ALLOWED',
          message: 'Conta de administrador não pode ter perfil profissional.',
        },
      },
      ACCOUNT_HAS_PATIENT_PROFILE: {
        summary: 'Conta com perfil de paciente',
        value: {
          status: 'ACCOUNT_HAS_PATIENT_PROFILE',
          message: 'A conta já possui um perfil de paciente.',
        },
      },
      PROFESSIONAL_PROFILE_ALREADY_EXISTS: {
        summary: 'Especialidade repetida na conta',
        value: {
          status: 'PROFESSIONAL_PROFILE_ALREADY_EXISTS',
          message:
            'A conta já possui um perfil profissional com essa especialidade.',
        },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    type: ErrorResponseDto,
    example: {
      status: 'ERROR',
      message: 'Não foi possível cadastrar o perfil profissional.',
    },
  })
  async create(
    @Body() body: CreateProfessionalRequestDto,
  ): Promise<ProfessionalProfileResponseDto> {
    return this.professionalsService.create(body);
  }
}
